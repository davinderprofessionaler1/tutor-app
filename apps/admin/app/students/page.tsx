import type { Metadata } from "next";
import { StudentWorkspace } from "../../components/student-workspace";

export const metadata: Metadata = { title: "Students" };
export default function StudentsPage() { return <StudentWorkspace/>; }
