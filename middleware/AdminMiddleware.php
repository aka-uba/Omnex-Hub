<?php
/**
 * AdminMiddleware - Admin/SuperAdmin Role Check
 *
 * @package OmnexDisplayHub
 */

class AdminMiddleware
{
    /**
     * Handle the request
     */
    public function handle(Request $request, callable $next): void
    {
        $user = Auth::user();

        if (!$user) {
            Response::unauthorized('Kimlik doğrulama gerekli');
        }

        $adminRoles = ['Admin', 'SuperAdmin'];

        if (!in_array($user['role'], $adminRoles)) {
            Response::forbidden('Bu işlem için yönetici yetkisi gerekli');
        }

        // Continue to next middleware/handler
        $next();
    }
}
