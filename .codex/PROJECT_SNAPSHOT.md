# Project Snapshot

Last updated: 2026-03-08

## Product

Omnex Display Hub:
- Electronic shelf label management (ESL)
- Digital signage / player management
- Multi-tenant company isolation

## Core stack

- Backend: PHP (custom architecture, no full-stack framework)
- Frontend: Vanilla JS SPA
- Database: PostgreSQL
- Runtime: Apache/XAMPP environment

## Key paths

- `api/`: backend endpoints
- `core/`: shared backend foundation (`Database.php`, `Router.php`, `Response.php`)
- `services/`: integrations and business services
- `middleware/`: auth/security/license checks
- `public/assets/js/`: frontend SPA core/pages/components
- `public/player/`: PWA player
- `database/postgresql/v2/`: active PostgreSQL schema scripts
- `docs/`: project documentation
- `.claude/CLAUDE.md`: deep historical/domain context

## Practical assumptions

- Route and module behavior may be coupled across frontend and API.
- Multi-tenant constraints must be preserved in all data operations.
- Changes often need syntax checks (PHP/JS) even for small edits.
