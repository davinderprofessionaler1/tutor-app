import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorizedStore, hasSafeOrigin } from "../../../../lib/api-auth";
import { writeAdminStore } from "../../../../lib/admin-store";

export async function GET(request: NextRequest) {
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const data = [...store.reviews]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .map((review) => ({
      ...review,
      courseTitle: store.courses.find((course) => course.id === review.courseId)?.title ?? "Removed course",
    }));
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest) {
  if (!hasSafeOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { id?: string; status?: string } | null;
  const review = store.reviews.find((item) => item.id === body?.id);
  if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  if (!body?.status || !["Pending", "Approved", "Rejected"].includes(body.status)) {
    return NextResponse.json({ error: "Choose a valid review status." }, { status: 400 });
  }
  review.status = body.status as typeof review.status;
  review.moderatedAt = review.status === "Pending" ? "" : new Date().toISOString();
  review.updatedAt = new Date().toISOString();
  await writeAdminStore(store);
  const data = {
    ...review,
    courseTitle: store.courses.find((course) => course.id === review.courseId)?.title ?? "Removed course",
  };
  return NextResponse.json({ message: review.status === "Approved" ? "Review approved and published." : review.status === "Rejected" ? "Review rejected." : "Review returned to pending.", data });
}
