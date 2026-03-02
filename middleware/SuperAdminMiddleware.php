<?php
/**
 * SuperAdminMiddleware - SuperAdmin Only Access
 *
 * @package OmnexDisplayHub
 */

class SuperAdminMiddleware
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

        if ($user['role'] !== 'superadmin') {
            Response::forbidden('Bu işlem için süper yönetici yetkisi gerekli');
        }

        // Continue to next middleware/handler
        $next();
    }
}
