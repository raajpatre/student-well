# Contributing to StudentWell

Thanks for taking the time. This guide covers the basics — local dev, branching, what we look for in a PR.

## Local development

1. Clone the repo and install:

   ```bash
   git clone https://github.com/<owner>/StudentWell.git
   cd StudentWell
   npm install
   ```

2. Bootstrap a Supabase project — see [`README.md`](README.md#2-bootstrap-the-database) and [`docs/DATABASE_SETUP.md`](docs/DATABASE_SETUP.md).

3. Copy environment files:

   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

   Fill them in. The README has a table of every variable.

4. Run the dev servers:

   ```bash
   npm run dev
   ```

5. Verify both halves build:

   ```bash
   npm run build           # builds server + client
   ```

## Branching

- `main` is the only long-lived branch. Render auto-deploys from it.
- Work on feature branches: `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`.
- Open a pull request against `main`. Squash-merge keeps history readable.

## What we look for in a PR

- A description that explains the *why*, not just the *what*. One paragraph is enough.
- Both `npm run build --workspace=server` and `npm run build --workspace=client` succeed.
- New tables or columns ship with a numbered migration in `migrations/`. Migrations must be additive and idempotent (use `IF NOT EXISTS`, `DROP POLICY IF EXISTS`, etc).
- New tables include RLS policies that match the existing patterns (students own rows, managers read tenant-wide, counsellors read assigned students).
- Server-side input is validated with a Zod schema. Errors are returned as `{ error: '...' }` with the right HTTP status.
- Newton tokens, Supabase service-role keys, and any other secret material are NEVER logged. Even partial logs are a no.
- Student-visible copy stays kind. The audience is a student in distress.

## Code style

- TypeScript strict everywhere; explicit return types on exported functions.
- 2-space indentation, single quotes, trailing commas. The server has Prettier set up — run `npm run format --workspace=server` before committing if you touched server code.
- Comments explain *why*. Function names explain *what*. Avoid restating the code in a comment.

## Tests

There's no automated test suite yet. If you can add one for what you're changing, please do — start with the pure functions (sentiment, dropout-risk, escalation regex). Three smoke scripts already exist in `scripts/test-*.ts`; they're a good pattern.

## Filing an issue

When opening an issue, please include:

- A clear title.
- Steps to reproduce (if it's a bug).
- The commit SHA you tested against.
- Browser / Node version if relevant.

For anything security-sensitive, see [`SECURITY.md`](SECURITY.md) — do not open a public issue.

## License

By contributing you agree your contributions are licensed under the MIT License (same as the project).
