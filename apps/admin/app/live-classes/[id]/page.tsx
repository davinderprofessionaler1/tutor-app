import { TeacherClassroom } from "../../../components/live/teacher-classroom";
import "../live.css";
export const metadata = { title: "Live Classroom" };
export default async function ClassroomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TeacherClassroom id={id} />;
}
