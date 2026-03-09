# Products Table Sorting Reference

Date: 2026-03-09  
Scope: `#/products` table sorting/filter behavior and reusable pattern for other pages

## 1. Goal

This reference defines the hybrid sorting model implemented for Products list:

1. Block ordering is preserved for same values (e.g. all `Şarküteri` rows stay contiguous).
2. On each header click (for selected columns), a different value block can be moved to top.
3. Pagination/filter interactions do not silently lock table to stale page state.

This model is intended to be reused on other list pages where users need both:

1. Strict sorted grouping behavior.
2. “Value cycle” visibility on first page.

## 2. Files and Responsibilities

1. `public/assets/js/components/DataTable.js`
- Generic table behavior.
- Emits sort change hook (`onSortChange`) with previous/current sort state.
- Resets to page 1 when sort changes.

2. `public/assets/js/pages/products/ProductList.js`
- Page-level sorting strategy for Products.
- Maintains value-cycle state and active anchor values.
- Sends `sort_anchor` to API only for target columns.
- Resets page 1 on external filter changes.

3. `api/products/index.php`
- Server-side sorting/filtering.
- Supports optional `sort_anchor` for `group` and `category`.
- Keeps deterministic fallback ordering: `..., LOWER(name) ASC, id ASC`.

## 3. Sorting Modes

### 3.1 Standard Columns

All non-target columns use standard sort:

1. `ASC/DESC` by selected column.
2. Then tie-breakers: `LOWER(name) ASC`, `id ASC`.

This includes columns such as:

1. `sku`
2. `name`
3. `barcode`
4. `current_price`
5. `stock`
6. `status`
7. `updated_at`

### 3.2 Hybrid Columns (`group`, `category`)

For `group` and `category` only:

1. Base order remains strict block sort by chosen direction.
2. Optional `sort_anchor` (single value) is prioritized first with SQL `CASE`.
3. Remaining rows follow base block order.

SQL pattern:

```sql
ORDER BY
  CASE WHEN LOWER(<col>) = LOWER(?) THEN 0 ELSE 1 END ASC,
  LOWER(<col>) <ASC|DESC> NULLS LAST,
  LOWER(name) ASC,
  id ASC
```

Result:

1. Anchor block appears first.
2. Rows in same value remain contiguous.
3. Non-anchor values stay normally sorted.

## 4. Frontend State Model (Products)

`ProductList` keeps these states:

1. `sortCycleValues.group`: list of group values.
2. `sortCycleValues.category`: global category list.
3. `categoryCycleByGroup`: category lists keyed by selected group.
4. `sortCycleIndex.{group|category}`: current cycle pointer.
5. `sortAnchor.{group|category}`: currently selected anchor value.

### 4.1 Click Flow

When user clicks a sortable header:

1. DataTable updates `sortBy/sortDir`.
2. DataTable calls `onSortChange({sortBy, sortDir, prevSortBy, prevSortDir})`.
3. ProductList decides if cycle applies:
- If column is not `group/category`: no cycle anchor.
- If `group/category`: move to next value in cycle list.
4. Next API request includes `sort_anchor` for that column.

### 4.2 Important Fix

Cycle index is reset only when sort column changes, not when direction changes.  
Reason: DataTable toggles direction every click; resetting on direction caused “stuck on single value”.

## 5. Group-Aware Category Cycle

Category header cycle is group-aware:

1. If `filter-group` is selected, category cycle uses only that group’s categories (`categoryCycleByGroup[group]`).
2. If no group selected, category cycle uses global category list.

This prevents irrelevant category anchors when user is already scoped by group.

## 6. Filter and Pagination Interactions

To avoid false “sorting broken” reports due to stale page offsets:

1. On sort change: page is reset to 1 (`DataTable`).
2. On external filters change/clear (`group`, `category`, `status`, `label`, `device`): page is reset to 1 before refresh (`ProductList`).

## 7. API Contract

Endpoint: `GET /api/products`

Relevant params:

1. `page`
2. `limit`
3. `search`
4. `sort_by`
5. `sort_dir`
6. `sort_anchor` (optional; effective only for `group/category`)
7. Existing filters (`group`, `category`, `status`, `has_label`, `has_device`)

Behavior rules:

1. If `sort_anchor` is empty or `sort_by` is not `group/category`: ignored.
2. If `sort_anchor` exists and `sort_by` is `group/category`: anchor block prioritized.

## 8. Reuse Template for Other Pages

To replicate this model on another table:

1. Add `onSortChange` handler in page-level DataTable config.
2. Keep page-level cycle states:
- `cycleValues`
- `cycleIndex`
- `sortAnchor`
3. In fetch function, pass `sort_anchor` only for chosen columns.
4. In backend index endpoint:
- add `sort_anchor` param
- apply `CASE WHEN ...` priority in `ORDER BY`
- preserve deterministic tie-breakers.
5. Reset page 1 on sort and external filter changes.

## 9. Known Constraints

1. This is a first-page visibility optimization, not a replacement for full analytics/group-by views.
2. If data is heavily skewed, non-anchor pages can still be dominated by large groups (expected).
3. Cycle value lists are loaded at page init; if data mutates heavily in-session, refresh page to rebuild lists.

## 10. Validation Checklist

Use this quick test after integrating on a page:

1. Click non-hybrid column (`name`) -> standard ASC/DESC behavior.
2. Click hybrid column repeatedly (`group`):
- first page top block changes each click
- rows inside selected value remain contiguous.
3. Apply external filter and click hybrid column:
- page resets to 1
- anchor cycle still advances.
4. Verify API query includes/excludes `sort_anchor` as expected.

