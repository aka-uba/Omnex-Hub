<?php
/**
 * CompanyMiddleware - Multi-Tenant Company Isolation
 *
 * @package OmnexDisplayHub
 */

class CompanyMiddleware
{
    /**
     * Handle the request
     */
    public function handle(Request $request, callable $next): void
    {
        $user = $request->getAttribute('user');

        if (!$user) {
            Response::unauthorized('Kimlik doğrulama gerekli');
        }

        // SuperAdmin can access all companies
        if ($user['role'] === 'superadmin') {
            // Check if company_id is provided in request (for switching context)
            $companyId = $request->input('company_id') ?? $request->query('company_id');

            if ($companyId) {
                $db = Database::getInstance();
                $company = $db->fetch(
                    "SELECT * FROM companies WHERE id = ? AND status = 'active'",
                    [$companyId]
                );

                if (!$company) {
                    Response::notFound('Firma bulunamadı');
                }

                $request->setAttribute('company_id', $companyId);
                $request->setAttribute('company', $company);
            }

            $next();
            return;
        }

        // Regular users must have a company
        if (!$user['company_id']) {
            Response::forbidden('Kullanıcı bir firmaya bağlı değil');
        }

        $db = Database::getInstance();
        $company = $db->fetch(
            "SELECT * FROM companies WHERE id = ? AND status = 'active'",
            [$user['company_id']]
        );

        if (!$company) {
            Response::forbidden('Firma bulunamadı veya aktif değil');
        }

        // Set company context
        $request->setAttribute('company_id', $user['company_id']);
        $request->setAttribute('company', $company);

        // Continue to next middleware/handler
        $next();
    }
}
