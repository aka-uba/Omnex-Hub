<?php
/**
 * Templates List API
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

// Pagination
$page = (int)($request->query('page', 1));
$perPage = (int)($request->query('per_page', 20));
$offset = ($page - 1) * $perPage;

// Search
$search = $request->query('search', '');
$type = $request->query('type', '');

// Build query
$where = [];
$params = [];

// Scope filter - allow filtering by 'system', 'company', or 'all'
$showScope = $request->query('scope', ''); // '', 'system', 'company', 'all'

// Check if user is SuperAdmin (case-insensitive)
$isSuperAdmin = strtolower($user['role'] ?? '') === 'superadmin';

if ($showScope === 'system') {
    // Only system templates
    $where[] = "(scope = 'system' OR company_id IS NULL)";
} elseif ($showScope === 'company') {
    // Only company templates
    if ($companyId) {
        $where[] = "company_id = ?";
        $params[] = $companyId;
    } else {
        // No company context - show nothing for company scope
        $where[] = "1 = 0";
    }
} else {
    // Default: show company templates + system templates
    // IMPORTANT: Always filter by company_id for non-SuperAdmin users
    if (!$isSuperAdmin) {
        if ($companyId) {
            // Show own company templates + system templates
            $where[] = "(company_id = ? OR scope = 'system' OR company_id IS NULL)";
            $params[] = $companyId;
        } else {
            // No company context, only system templates
            $where[] = "(scope = 'system' OR company_id IS NULL)";
        }
    } else {
        // SuperAdmin
        if ($companyId) {
            // SuperAdmin with selected company - show that company + system
            $where[] = "(company_id = ? OR scope = 'system' OR company_id IS NULL)";
            $params[] = $companyId;
        }
        // SuperAdmin with no company selected sees everything (for admin panel)
    }
}

// Search filter
if ($search) {
    $where[] = "(name LIKE ? OR description LIKE ?)";
    $params[] = "%$search%";
    $params[] = "%$search%";
}

// Type filter - map frontend type to database type
if ($type) {
    $typeMap = ['esl' => 'label', 'signage' => 'signage', 'tv' => 'tv', 'label_printer' => 'label'];
    $dbType = $typeMap[$type] ?? $type;
    $where[] = "type = ?";
    $params[] = $dbType;

    // label_printer için ayrıca category filtresi ekle
    if ($type === 'label_printer') {
        $where[] = "category = ?";
        $params[] = 'label_printer';
    }
}

$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

// Get total count
$total = $db->fetchColumn("SELECT COUNT(*) FROM templates $whereClause", $params);

// Get templates
$templates = $db->fetchAll(
    "SELECT * FROM templates $whereClause ORDER BY created_at DESC LIMIT ? OFFSET ?",
    array_merge($params, [$perPage, $offset])
);

// Map database fields to frontend expected fields
$typeMapReverse = ['label' => 'esl', 'signage' => 'signage', 'tv' => 'tv'];
foreach ($templates as &$template) {
    // label_printer uses category field to distinguish from regular esl/label
    if ($template['type'] === 'label' && $template['category'] === 'label_printer') {
        $template['type'] = 'label_printer';
    } else {
        $template['type'] = $typeMapReverse[$template['type']] ?? $template['type'];
    }
    $template['content'] = $template['design_data'];
    $template['thumbnail'] = $template['preview_image'];

    // New fields from migration 021
    $template['layout_type'] = $template['layout_type'] ?? 'full';
    $template['template_file'] = $template['template_file'] ?? null;
    $template['slots'] = $template['slots'] ? json_decode($template['slots'], true) : null;
}

Response::paginated($templates, $total, $page, $perPage);
