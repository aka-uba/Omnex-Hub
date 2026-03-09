# Codex Project Operating Notes

This repository uses a local Codex memory workflow.

## Mandatory startup steps (every task)

1. Read `.codex/PROJECT_SNAPSHOT.md`.
2. Read `.codex/WORKFLOW.md`.
3. Read the latest entries in `.codex/CHANGE_MEMORY.md` (last 80 lines is enough).
4. If needed, read `.claude/CLAUDE.md` for deep domain context.

## Mandatory before-final-response steps

1. Update `.codex/CHANGE_MEMORY.md` with:
   - date
   - request summary
   - changed files
   - checks run
   - risks or follow-up
2. Run checks from `.codex/QUICK_CHECKS.md` that match changed files.
3. Report what was changed and which checks were run.

## Guardrails

- Do not log secrets, tokens, passwords, or private keys in memory files.
- Keep entries short and practical.
- Prefer incremental edits over large rewrites.
- Encoding safety is critical: preserve each file's existing encoding during edits.
- Prevent corruption/data loss: when edit risk is high, create a temporary backup copy first and restore from it if write output is malformed.
- Do not add hardcoded user-facing text; use i18n keys.
- Every new/changed user-facing text must be added for all 8 supported languages.
- Preserve original language characters exactly; never strip diacritics in localized text unless source is intentionally ASCII.
