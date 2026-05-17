# Security policy

## Reporting a vulnerability

If you find a vulnerability — credential exposure, an RLS bypass, a way to escalate role,
prompt-injection that breaks chat safety, anything that compromises a student's data — **please
do not open a public issue**.

Email the maintainer with:

- a clear description of the problem,
- steps to reproduce (or a proof of concept),
- the commit SHA you tested against,
- your suggested fix if you have one.

We aim to acknowledge within 72 hours and ship a patch within two weeks for high-severity reports.

## Scope

In scope:
- Authentication / authorisation flaws (auth bypass, role confusion, token leakage)
- Tenant isolation bypass (cross-tenant reads or writes)
- Newton-token handling (decryption, logging, in-transit exposure)
- Prompt-injection that bypasses the three-level escalation detector
- SQL injection (unlikely given the Supabase client, but worth a check)
- XSS in any student-content surface (chat, reflections, social posts, recommendations)
- Rate-limiter bypass that enables abuse of chat / sync / login

Out of scope:
- Findings that require a compromised Supabase service-role key or a compromised host
- Denial of service via single-source flooding (rate limits will catch this, by design)
- Social engineering against humans

## Sensitive data classes

The system handles two kinds of sensitive data:

1. **Student wellness data** — check-in scores, free-text reflections, chat transcripts. All
   tenant-isolated, students can only read their own.
2. **Newton access tokens** — encrypted at rest (AES-256-GCM), never logged, only decrypted
   just-in-time inside `newtonSync.syncStudent`. The encryption key (`ENCRYPTION_KEY`) is a
   server-only secret; rotating it invalidates every stored token.

## What we do already

- **Postgres RLS** on every tenant table. Application-level checks AND DB-level policies.
- **Helmet** for default security headers.
- **CORS** allowlist scoped to the configured client origin (`CLIENT_URL`).
- **Rate limits** keyed on user id (not IP) for chat, check-in, sync, login.
- **Zod** schemas on every write route; rejected requests never reach Supabase.
- **No `dangerouslySetInnerHTML`** anywhere in the client.
- **No service-role key** is ever sent to the browser.

## Recent audit

A full security audit was performed before the initial public release covering: secret exposure,
RLS coverage, route protection, input validation, token handling, prompt-injection patterns,
CORS, rate limiting, encryption, error-handling leakage, SQL injection, XSS, JWT lifecycle, and
dependency vulnerabilities. `npm audit` reported zero advisories at the time. Re-run before every
deploy.
