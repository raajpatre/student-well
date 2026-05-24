## What this changes

<!-- One paragraph. The *why*, not just the *what*. -->

## How I tested

<!-- Manual steps, smoke scripts, or unit tests. -->

## Checklist

- [ ] `npm run build` passes (server + client).
- [ ] If this adds tables or columns, there's a numbered, idempotent migration in `migrations/`.
- [ ] If this adds tables, RLS policies match the existing patterns.
- [ ] New write routes have a Zod schema and `validateBody`.
- [ ] No secrets, tokens, or PII in code, logs, comments, or test fixtures.
- [ ] Student-visible copy stays kind.
