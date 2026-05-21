export type UserRole = "recruiter" | "candidate";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Interview {
  id: string;
  recruiter_id: string;
  candidate_email: string;
  job_title: string;
  job_description: string;
  resume_text?: string;
  status: "pending" | "active" | "completed";
  score?: number;
  score_breakdown?: ScoreBreakdown;
  created_at: string;
  completed_at?: string;
}

export interface InterviewTurn {
  id: string;
  interview_id: string;
  turn_number: number;
  speaker: "ai" | "candidate";
  text: string;
  audio_url?: string;
  timestamp: string;
}

export interface ScoreBreakdown {
  communication: { score: number; note: string };
  technical_depth: { score: number; note: string };
  problem_solving: { score: number; note: string };
  cultural_fit: { score: number; note: string };
  strengths: string[];
  concerns: string[];
  recommendation: "advance" | "hold" | "reject";
  summary: string;
}
