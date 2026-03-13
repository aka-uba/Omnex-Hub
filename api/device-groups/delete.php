<?php
/**
 * Device Groups - Delete
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$id = $request->routeParam('id');

try {
    // Check if group exists
    $group = $db->fetch(
        "SELECT * FROM device_groups WHERE id = ? AND company_id = ?",
        [$id, $companyId]
    );

    if (!$group) {
        Response::notFound('Grup bulunamadi');
    }

    $db->beginTransaction();
    try {
        // Delete members first
        $db->delete('device_group_members', 'group_id = ?', [$id]);

        // Delete group
        $db->delete('device_groups', 'id = ?', [$id]);
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }

    try {
        Logger::audit('delete', 'device_group', [
            'id' => $id,
            'old' => $group
        ]);
    } catch (Throwable $auditError) {
        error_log('Device group delete audit skipped: ' . $auditError->getMessage());
    }

    Response::success(['message' => 'Grup silindi']);
} catch (Throwable $e) {
    Logger::error('Device group delete error', ['error' => $e->getMessage()]);
    Response::serverError('Grup silinemedi');
}
