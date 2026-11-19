export type CourseLevel = "Beginner" | "Intermediate" | "Advanced";
export type LiveClassStatus = "Draft" | "Scheduled" | "Live" | "Completed" | "Cancelled";
export interface LiveClassView {
  id: string; title: string; description: string; objectives: string; instructions: string;
  teacherId: string; teacherName: string; courseId: string | null; courseTitle: string; coursePrice: number;
  thumbnailUrl: string; startsAt: string; timeZone: string; durationMinutes: number; capacity: number; price: number;
  enrollmentDeadline: string | null; accessType: "individual" | "course" | "both"; status: LiveClassStatus;
  startedAt: string | null; endedAt: string | null; chatEnabled: boolean;
  enrollmentCount: number; availableSeats: number; accessible: boolean; enrollmentType: string | null;
  canJoin: boolean; paymentStatus: string; revenue?: number;
}
export interface ClassroomParticipant { identity: string; name: string; role: "teacher" | "student"; raisedHand: boolean; microphone: boolean; camera: boolean }
export interface ClassroomMessage { id: string; name: string; role: "teacher" | "student"; text: string; createdAt: string }
export interface ClassroomSnapshot { ok: boolean; status: string; chatEnabled: boolean; microphone: boolean; camera: boolean; raisedHand: boolean; participants: ClassroomParticipant[]; messages: ClassroomMessage[] }
export interface ClassroomJoin { token: string; url: string; identity: string; ticketId: string; title: string; startedAt: string }
export type CourseAccess = "Lifetime" | "Fixed duration";

export interface PublicBranding {
  siteName: string;
  appName?: string;
  tutorName: string;
  supportEmail: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  announcement: string;
}

export interface CourseLesson {
  id: string;
  title: string;
  durationMinutes: number;
  isPreview: boolean;
  isCompleted?: boolean;
}

export interface CourseSection {
  id: string;
  title: string;
  lessons: CourseLesson[];
}

export interface PublicCourse {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  category: string;
  level: CourseLevel;
  originalPrice: number;
  salePrice: number;
  currency: string;
  rating: number;
  reviewCount: number;
  studentCount: number;
  durationHours: number;
  lessonCount: number;
  access: CourseAccess;
  featured: boolean;
  accent: string;
  outcomes: string[];
  sections: CourseSection[];
}

export interface CourseListResponse {
  data: PublicCourse[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface DashboardSummary {
  students: number;
  activeStudents: number;
  publishedCourses: number;
  enrollments: number;
  revenue: number;
  currency: string;
}
