// Type definitions for the Newton School REST API.
// Shapes are derived from real responses captured in scripts/newton-api-contract.json.

export interface NewtonMe {
  username: string;
  uid: string;
  first_name: string;
  last_name: string;
  avatar: string | null;
  bio: string | null;
  email: string;
  is_email_verified: boolean;
  phone: string | null;
  is_phone_verified: boolean;
  show_only_my_tracks: boolean;
  hide_timestamps: boolean;
  athena_versions: string[];
  heimdall_versions: string[];
}

export interface NewtonChildrenCourses {
  is_parent_admin_unit_course?: boolean;
  admin_unit_courses?: NewtonCourseRef[];
}

export interface NewtonCourseRef {
  hash: string;
  title: string;
  start_timestamp?: number | null;
  end_timestamp?: number | null;
  completed?: boolean;
}

export interface NewtonCourse {
  hash: string;
  title: string;
  course_structure?: { title?: string; slug?: string } | null;
  start_timestamp?: number | null;
  end_timestamp?: number | null;
  status?: number;
  status_text?: string;
  user_status?: number;
  user_status_text?: string;
  course_type?: number;
  course_type_text?: string;
  completed?: boolean;
  is_elective?: boolean;
  children_courses?: NewtonChildrenCourses | Record<string, never>;
}

export type NewtonCourses = NewtonCourse[];

export interface NewtonCourseOverview {
  total_lectures: number;
  total_lectures_attended: number;
  total_assignment_questions: number;
  total_completed_assignment_questions: number;
  total_contest_questions: number;
  total_completed_contest_questions: number;
  total_assessments: number;
  total_completed_assessments: number;
  total_contest_assessments: number;
  total_completed_contest_assessments: number;
}

export interface NewtonArenaStats {
  is_xp_enabled: boolean;
  total_earned_points: number;
  total_earned_points_current_month: number;
  is_unlocked: boolean;
  is_unlocked_for_current_month: boolean;
  points_required_to_unlock: number;
  points_required_to_unlock_monthly_xp: number;
  monthly_rank: number | null;
  overall_rank: number | null;
  student_count: number;
}
