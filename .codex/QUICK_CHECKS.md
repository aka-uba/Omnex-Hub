# Quick Checks

Run only what matches touched files.

## PHP syntax

Use for any `.php` file:

```powershell
php -l path\to\file.php
```

## JS syntax

Use for plain browser/node `.js` files:

```powershell
node --check path\to\file.js
```

## Android player (if touched)

```powershell
.\gradlew.bat :app:compileDebugKotlin
```

## API spot check (optional)

If endpoint behavior changed, call it in local env with existing auth/session and verify expected JSON shape.

## Minimum completion rule

- At least one syntax check must be run for every code edit.
- If checks are skipped, reason must be written in `CHANGE_MEMORY.md`.
