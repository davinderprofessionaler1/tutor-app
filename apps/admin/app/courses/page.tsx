import type { Metadata } from "next";
import { CourseWorkspace } from "../../components/course-workspace";

export const metadata: Metadata = { title: "Courses" };

export default function CoursesPage() {
  return <CourseWorkspace />;
}
