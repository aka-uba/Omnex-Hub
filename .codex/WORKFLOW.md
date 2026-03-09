# Default Workflow

Last updated: 2026-03-08

## 1) Understand request

- Map request to backend/API/frontend/database areas.
- Identify minimal file set to inspect first.

## 2) Inspect current behavior

- Read relevant files before editing.
- Check nearby patterns and naming conventions.

## 3) Implement

- Keep edits focused and compatible with existing style.
- Avoid unrelated refactors unless requested.
- Preserve original file encoding; do not silently convert encoding during write.
- If a file has non-trivial encoding or high breakage risk, create a temp backup before editing and verify content integrity after write.
- Do not introduce hardcoded UI/user-facing strings; route text through i18n.
- For every added/updated key, update all 8 language files in scope.
- Preserve diacritics/special characters in localized content; do not ASCII-normalize translated strings.

## 4) Verify

- Run relevant commands from `QUICK_CHECKS.md`.
- Prefer targeted checks for touched files first.
- If localization files changed, verify key parity across all 8 languages and check for accidental character degradation.

## 5) Record memory

- Append one entry to `CHANGE_MEMORY.md`:
  - date
  - user request
  - files changed
  - checks run
  - known risk / follow-up
  - whether backup/restore safety steps were used
