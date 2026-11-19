export type CourseLevel = "Beginner" | "Intermediate" | "Advanced";
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
