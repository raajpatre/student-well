/**
 * Newton REST API endpoint discovery script.
 *
 * Reads the access_token from ~/.newton-mcp/credentials.json, probes a list of
 * candidate endpoints, and writes the working ones (with response shape samples)
 * to scripts/newton-api-contract.json.
 *
 * Usage: npx tsx scripts/discover-newton-api.ts
 *
 * SECURITY: the access token is never logged — only the request path and status.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

const BASE = 'https://my.newtonschool.co';
const UA = 'newton-mcp/0.3.2';

interface ProbeOutcome {
  path: string;
  method: 'GET';
  status: number;
  ok: boolean;
  bodyPreview?: string;
  parsedSample?: unknown;
  errorNote?: string;
}

interface ContractEndpoint {
  method: 'GET';
  path: string;
  status: number;
  response_shape: unknown;
}

interface Contract {
  generated_at: string;
  base_url: string;
  endpoints: Record<string, ContractEndpoint>;
  failures: Record<string, { path: string; status: number; note?: string }>;
}

async function readToken(): Promise<string> {
  const credPath = path.join(homedir(), '.newton-mcp', 'credentials.json');
  const raw = await readFile(credPath, 'utf-8');
  const parsed = JSON.parse(raw) as { access_token?: string };
  if (!parsed.access_token) throw new Error('access_token missing from credentials.json');
  return parsed.access_token;
}

async function probe(token: string, p: string): Promise<ProbeOutcome> {
  try {
    const res = await fetch(`${BASE}${p}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'User-Agent': UA,
      },
    });
    const text = await res.text();
    const outcome: ProbeOutcome = {
      path: p,
      method: 'GET',
      status: res.status,
      ok: res.ok,
      bodyPreview: text.slice(0, 500),
    };
    if (res.ok) {
      try {
        outcome.parsedSample = sampleShape(JSON.parse(text));
      } catch {
        outcome.errorNote = 'response was not JSON';
      }
    }
    return outcome;
  } catch (err: any) {
    return {
      path: p,
      method: 'GET',
      status: 0,
      ok: false,
      errorNote: err?.message ?? 'network error',
    };
  }
}

/**
 * Reduces a JSON value to a structural sample:
 *  - objects: keep all top-level keys, recurse one level
 *  - arrays: keep first element shape + count
 *  - primitives: keep type label
 */
function sampleShape(value: unknown, depth = 0): unknown {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return { __type: 'array', length: 0 };
    return {
      __type: 'array',
      length: value.length,
      sample: depth < 3 ? sampleShape(value[0], depth + 1) : typeof value[0],
    };
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = depth < 3 ? sampleShape(v, depth + 1) : typeof v;
    }
    return out;
  }
  return typeof value;
}

async function main() {
  const token = await readToken();
  // eslint-disable-next-line no-console
  console.log(`[discover] base=${BASE} tokenLen=${token.length}`);

  // ── User profile candidates ─────────────────────────────────────
  const meCandidates = [
    '/api/v1/user/me',
    '/api/v1/users/me',
    '/api/v2/user/me',
    '/api/v2/users/me',
    '/api/v2/me',
    '/api/v1/me',
    '/api/v2/user/me/',
    '/api/v2/profile/',
    '/api/v2/user/profile/',
  ];

  // ── Courses list ─────────────────────────────────────────────────
  const coursesPath = '/api/v2/course/all/applied/?pagination=false&completed=false';

  const contract: Contract = {
    generated_at: new Date().toISOString(),
    base_url: BASE,
    endpoints: {},
    failures: {},
  };

  const results: Record<string, ProbeOutcome[]> = {};

  // Probe profile candidates
  results.get_me = [];
  for (const p of meCandidates) {
    const out = await probe(token, p);
    results.get_me.push(out);
    // eslint-disable-next-line no-console
    console.log(`  GET ${p} -> ${out.status}`);
    if (out.ok && !contract.endpoints.get_me) {
      contract.endpoints.get_me = {
        method: 'GET',
        path: p,
        status: out.status,
        response_shape: out.parsedSample,
      };
    }
  }
  if (!contract.endpoints.get_me) {
    contract.failures.get_me = { path: meCandidates.join(' | '), status: 404, note: 'no candidate returned 200' };
  }

  // Probe courses list
  results.list_courses = [];
  const coursesOutcome = await probe(token, coursesPath);
  results.list_courses.push(coursesOutcome);
  // eslint-disable-next-line no-console
  console.log(`  GET ${coursesPath} -> ${coursesOutcome.status}`);
  if (coursesOutcome.ok) {
    contract.endpoints.list_courses = {
      method: 'GET',
      path: coursesPath,
      status: coursesOutcome.status,
      response_shape: coursesOutcome.parsedSample,
    };
  } else {
    contract.failures.list_courses = { path: coursesPath, status: coursesOutcome.status };
  }

  // Determine a course hash to probe overview/perf endpoints with
  let courseHash: string | undefined;
  try {
    if (coursesOutcome.ok && coursesOutcome.bodyPreview) {
      const refetch = await fetch(`${BASE}${coursesPath}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': UA },
      });
      const json = await refetch.json();
      const arr: any[] = Array.isArray(json) ? json : json?.results ?? [];
      const nst = arr.find((c) => c?.children_courses?.is_parent_admin_unit_course === true);
      if (nst) {
        const sems: any[] = nst.children_courses?.admin_unit_courses ?? [];
        courseHash = sems[0]?.hash;
      }
      if (!courseHash) courseHash = arr[0]?.hash;
    }
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn('[discover] could not parse course hash:', err?.message);
  }

  // eslint-disable-next-line no-console
  console.log(`[discover] courseHash=${courseHash ?? '(none)'}`);

  // ── Per-course probes ───────────────────────────────────────────
  if (courseHash) {
    const coursePathCandidates: { name: string; paths: string[] }[] = [
      {
        name: 'get_course_overview',
        paths: [
          `/api/v2/course/h/${courseHash}/self_performance/`,
          `/api/v2/course/${courseHash}/overview`,
          `/api/v2/course/${courseHash}/details`,
          `/api/v2/course/h/${courseHash}/overview/`,
          `/api/v2/course/h/${courseHash}/`,
          `/api/v1/course/${courseHash}`,
        ],
      },
      {
        name: 'get_arena_stats',
        paths: [
          `/api/v2/course/h/${courseHash}/experience_points/`,
          `/api/v2/course/h/${courseHash}/arena/stats`,
          `/api/v2/course/${courseHash}/arena/stats`,
          `/api/v1/arena/stats`,
          `/api/v2/arena/stats`,
        ],
      },
      {
        name: 'get_subject_progress',
        paths: [
          `/api/v2/course/h/${courseHash}/subject_progress/`,
          `/api/v2/course/h/${courseHash}/subjects/`,
          `/api/v2/course/h/${courseHash}/progress/`,
          `/api/v2/course/${courseHash}/subject_progress`,
        ],
      },
    ];

    for (const group of coursePathCandidates) {
      results[group.name] = [];
      for (const p of group.paths) {
        const out = await probe(token, p);
        results[group.name].push(out);
        // eslint-disable-next-line no-console
        console.log(`  GET ${p} -> ${out.status}`);
        if (out.ok && !contract.endpoints[group.name]) {
          contract.endpoints[group.name] = {
            method: 'GET',
            path: p.replace(courseHash, '{course_hash}'),
            status: out.status,
            response_shape: out.parsedSample,
          };
        }
      }
      if (!contract.endpoints[group.name]) {
        contract.failures[group.name] = {
          path: group.paths.join(' | '),
          status: 404,
          note: 'no candidate returned 200',
        };
      }
    }
  } else {
    contract.failures.get_course_overview = { path: '(skipped — no course hash)', status: 0 };
    contract.failures.get_arena_stats = { path: '(skipped — no course hash)', status: 0 };
    contract.failures.get_subject_progress = { path: '(skipped — no course hash)', status: 0 };
  }

  const outPath = path.join(process.cwd(), 'scripts', 'newton-api-contract.json');
  await writeFile(outPath, JSON.stringify(contract, null, 2), 'utf-8');

  // eslint-disable-next-line no-console
  console.log(`\n[discover] wrote ${outPath}`);
  // eslint-disable-next-line no-console
  console.log('[discover] summary:');
  for (const [name, ep] of Object.entries(contract.endpoints)) {
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${name}: ${ep.path}`);
  }
  for (const [name, f] of Object.entries(contract.failures)) {
    // eslint-disable-next-line no-console
    console.log(`  ✗ ${name}: ${f.path} (${f.status})`);
  }

  // Also write a verbose log
  const verbosePath = path.join(process.cwd(), 'scripts', 'newton-api-probe-log.json');
  await writeFile(verbosePath, JSON.stringify(results, null, 2), 'utf-8');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[discover] fatal:', err);
  process.exit(1);
});
