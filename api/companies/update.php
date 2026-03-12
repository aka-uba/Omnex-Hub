<?php
/**
 * Update Company API (Admin Only)
 *
 * Firma guncelleme - Lisans sadece plan_id ile yonetilir
 * Tum limitler license_plans tablosundan alinir
 */

require_once BASE_PATH . '/services/LicenseService.php';

$db = Database::getInstance();
$id = $request->routeParam('id');

$company = $db->fetch("SELECT * FROM companies WHERE id = ?", [$id]);
if (!$company) {
    Response::notFound('Şirket bulunamadı');
}

$data = ['updated_at' => date('Y-m-d H:i:s')];

if ($request->has('name')) $data['name'] = $request->input('name');
if ($request->has('code')) $data['code'] = $request->input('code');
if ($request->has('slug')) $data['slug'] = $request->input('slug');
if ($request->has('email')) $data['email'] = $request->input('email');
if ($request->has('phone')) $data['phone'] = $request->input('phone');
if ($request->has('address')) $data['address'] = $request->input('address');
if ($request->has('status')) $data['status'] = $request->input('status');
if ($request->has('primary_color')) $data['primary_color'] = $request->input('primary_color');
if ($request->has('secondary_color')) $data['secondary_color'] = $request->input('secondary_color');
if ($request->has('domain')) $data['domain'] = $request->input('domain');
if ($request->has('subdomain')) $data['subdomain'] = $request->input('subdomain');

// Store old company for audit
$oldCompany = $company;
$pendingAudits = [];
$refreshLicenseCache = false;

$planId = $request->input('plan_id');
$licenseExpiresAt = $request->input('license_expires_at');

$db->beginTransaction();

try {
    $db->update('companies', $data, 'id = ?', [$id]);

    // Update license if plan_id is provided
    if ($planId) {
        $plan = $db->fetch("SELECT * FROM license_plans WHERE id = ?", [$planId]);

        if ($plan) {
            $license = $db->fetch("SELECT * FROM licenses WHERE company_id = ? AND status = 'active'", [$id]);

            if ($license) {
                $updateData = [
                    'plan_id' => $planId,
                    'updated_at' => date('Y-m-d H:i:s')
                ];

                if ($licenseExpiresAt) {
                    $updateData['valid_until'] = $licenseExpiresAt;
                } elseif (in_array($plan['plan_type'], ['enterprise', 'ultimate', 'unlimited'], true)) {
                    $updateData['valid_until'] = null;
                }

                $db->update('licenses', $updateData, 'id = ?', [$license['id']]);
                $refreshLicenseCache = true;

                $pendingAudits[] = ['update', 'license', [
                    'id' => $license['id'],
                    'old' => ['plan_id' => $license['plan_id'] ?? null],
                    'new' => ['plan_id' => $planId, 'plan_type' => $plan['plan_type']]
                ]];
            } else {
                $companyCodeRow = $db->fetch("SELECT code FROM companies WHERE id = ?", [$id]);
                $code = $companyCodeRow['code'] ?? 'XXX';

                $endDate = $licenseExpiresAt;
                if (!$endDate) {
                    if (in_array($plan['plan_type'], ['enterprise', 'ultimate', 'unlimited'], true)) {
                        $endDate = null;
                    } else {
                        $months = $plan['duration_months'] ?? 12;
                        $endDate = date('Y-m-d H:i:s', strtotime("+{$months} months"));
                    }
                }

                $licenseKey = strtoupper(substr($code, 0, 4) . '-' . bin2hex(random_bytes(4)) . '-' . bin2hex(random_bytes(4)));

                $db->insert('licenses', [
                    'id' => $db->generateUuid(),
                    'company_id' => $id,
                    'plan_id' => $planId,
                    'license_key' => $licenseKey,
                    'valid_from' => date('Y-m-d H:i:s'),
                    'valid_until' => $endDate,
                    'status' => 'active'
                ]);

                $refreshLicenseCache = true;
                $pendingAudits[] = ['create', 'license', [
                    'company_id' => $id,
                    'plan_id' => $planId,
                    'plan_type' => $plan['plan_type']
                ]];
            }
        }
    } elseif ($request->has('plan')) {
        // Backward compatibility: map old plan text values
        $newPlan = $request->input('plan');

        $planMapping = [
            'Free' => 'trial',
            'free' => 'trial',
            'Standard' => 'starter',
            'standard' => 'starter',
            'Professional' => 'business',
            'professional' => 'business',
            'Enterprise' => 'ultimate',
            'enterprise' => 'ultimate',
            'Ultimate' => 'ultimate',
            'ultimate' => 'ultimate',
            'trial' => 'trial',
            'starter' => 'starter',
            'business' => 'business',
        ];
        $dbType = $planMapping[$newPlan] ?? 'starter';

        $matchedPlan = $db->fetch(
            "SELECT id FROM license_plans WHERE plan_type = ? ORDER BY created_at DESC LIMIT 1",
            [$dbType]
        );

        $license = $db->fetch("SELECT * FROM licenses WHERE company_id = ?", [$id]);

        if ($license) {
            $updateData = ['updated_at' => date('Y-m-d H:i:s')];
            if ($matchedPlan) {
                $updateData['plan_id'] = $matchedPlan['id'];
            }
            $db->update('licenses', $updateData, 'id = ?', [$license['id']]);
            $refreshLicenseCache = true;
        } else {
            $licenseId = $db->generateUuid();
            $licenseKey = strtoupper(substr(md5(uniqid()), 0, 16));
            $insertData = [
                'id' => $licenseId,
                'company_id' => $id,
                'license_key' => $licenseKey,
                'status' => 'active',
                'valid_from' => date('Y-m-d H:i:s'),
                'valid_until' => date('Y-m-d H:i:s', strtotime('+1 year'))
            ];
            if ($matchedPlan) {
                $insertData['plan_id'] = $matchedPlan['id'];
            }
            $db->insert('licenses', $insertData);
            $refreshLicenseCache = true;
        }
    }

    $company = $db->fetch("SELECT * FROM companies WHERE id = ?", [$id]);
    $db->commit();
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }

    Logger::error('Company update error', [
        'company_id' => $id,
        'error' => $e->getMessage()
    ]);
    Response::serverError();
}

if ($refreshLicenseCache) {
    try {
        LicenseService::clearCache($id);
    } catch (Throwable $e) {
        error_log('Company update cache clear skipped: ' . $e->getMessage());
    }
}

foreach ($pendingAudits as $auditEntry) {
    try {
        Logger::audit($auditEntry[0], $auditEntry[1], $auditEntry[2]);
    } catch (Throwable $e) {
        error_log('Company update audit skipped: ' . $e->getMessage());
    }
}

try {
    Logger::audit('update', 'company', [
        'id' => $id,
        'old' => [
            'name' => $oldCompany['name'],
            'status' => $oldCompany['status']
        ],
        'new' => [
            'name' => $company['name'],
            'status' => $company['status']
        ]
    ]);
} catch (Throwable $e) {
    error_log('Company update audit skipped: ' . $e->getMessage());
}

Response::success($company, 'Şirket güncellendi');
