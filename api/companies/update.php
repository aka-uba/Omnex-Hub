<?php
/**
 * Update Company API (Admin Only)
 *
 * Firma güncelleme - Lisans sadece plan_id ile yönetilir
 * Tüm limitler license_plans tablosundan alınır
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

$db->update('companies', $data, 'id = ?', [$id]);

// Update license if plan_id is provided
// NOT: Limitler sadece license_plans tablosundan okunur
// licenses tablosunda limit alanları artık kullanılmıyor
$planId = $request->input('plan_id');
$licenseExpiresAt = $request->input('license_expires_at');

if ($planId) {
    // Plan bilgisini al
    $plan = $db->fetch("SELECT * FROM license_plans WHERE id = ?", [$planId]);

    if ($plan) {
        $license = $db->fetch("SELECT * FROM licenses WHERE company_id = ? AND status = 'active'", [$id]);

        if ($license) {
            // Mevcut lisansı güncelle (sadece plan_id ve süre bilgisi)
            // NOT: type/period kolonları artık yok, tüm bilgiler license_plans'tan alınır
            $updateData = [
                'plan_id' => $planId,
                'updated_at' => date('Y-m-d H:i:s')
            ];

            // Bitiş tarihi belirtilmişse güncelle
            if ($licenseExpiresAt) {
                $updateData['valid_until'] = $licenseExpiresAt;
            } else if (in_array($plan['plan_type'], ['enterprise', 'ultimate', 'unlimited'])) {
                // Sınırsız plan tipleri için bitiş tarihi kaldır
                $updateData['valid_until'] = null;
            }

            $db->update('licenses', $updateData, 'id = ?', [$license['id']]);

            // Cache temizle
            LicenseService::clearCache($id);

            // Audit log for license update
            Logger::audit('update', 'license', [
                'id' => $license['id'],
                'old' => ['plan_id' => $license['plan_id'] ?? null],
                'new' => ['plan_id' => $planId, 'plan_type' => $plan['plan_type']]
            ]);
        } else {
            // Yeni lisans oluştur (sadece plan_id ve süre bilgisi)
            $company = $db->fetch("SELECT code FROM companies WHERE id = ?", [$id]);
            $code = $company['code'] ?? 'XXX';

            // Lisans bitiş tarihi
            $endDate = $licenseExpiresAt;
            if (!$endDate) {
                // Sınırsız plan tipleri için bitiş tarihi yok
                if (in_array($plan['plan_type'], ['enterprise', 'ultimate', 'unlimited'])) {
                    $endDate = null;
                } else {
                    $months = $plan['duration_months'] ?? 12;
                    $endDate = date('Y-m-d H:i:s', strtotime("+{$months} months"));
                }
            }

            // Lisans anahtarı oluştur
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

            // Audit log for license creation
            Logger::audit('create', 'license', [
                'company_id' => $id,
                'plan_id' => $planId,
                'plan_type' => $plan['plan_type']
            ]);
        }
    }
} else if ($request->has('plan')) {
    // Eski format desteği (geriye uyumluluk)
    // Plan adını license_plans tablosundan eşleştirmeye çalış
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

    // license_plans tablosundan plan_id bul
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
    }
}

$company = $db->fetch("SELECT * FROM companies WHERE id = ?", [$id]);

// Audit log
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

Response::success($company, 'Şirket güncellendi');
