import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import {
  newtonGetMe,
  newtonListCourses,
  newtonGetCourseOverview,
  newtonGetArenaStats,
  pickActiveCourse,
} from '../server/src/services/newton/newtonRestClient';

async function main() {
  const cred = JSON.parse(await readFile(path.join(homedir(), '.newton-mcp', 'credentials.json'), 'utf-8'));
  const token: string = cred.access_token;

  const me = await newtonGetMe(token);
  console.log('me:', me.username, me.email);

  const courses = await newtonListCourses(token);
  const active = pickActiveCourse(courses);
  console.log('course:', active.title, active.hash);

  const overview = await newtonGetCourseOverview(token, active.hash);
  console.log('overview:', JSON.stringify(overview, null, 2));

  const arena = await newtonGetArenaStats(token, active.hash);
  console.log('arena:', JSON.stringify(arena, null, 2));

  const attendancePct = overview.total_lectures > 0
    ? (overview.total_lectures_attended / overview.total_lectures) * 100
    : 0;
  const assignmentPct = overview.total_assignment_questions > 0
    ? (overview.total_completed_assignment_questions / overview.total_assignment_questions) * 100
    : 0;
  console.log(`attendance: ${attendancePct.toFixed(2)}%`);
  console.log(`assignments: ${assignmentPct.toFixed(2)}%`);
}

main().catch(err => { console.error('FAIL:', err); process.exit(1); });
