import type { CourseListResponse, PublicBranding, PublicCourse } from "@tutor/contracts";
import { demoBranding, demoCourses } from "./demo-data";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export async function getBranding(): Promise<PublicBranding> {
  try {
    const response = await fetch(`${apiUrl}/public/settings`, { next: { revalidate: 300 } });
    if (!response.ok) throw new Error("Branding request failed");
    return (await response.json() as { data: PublicBranding }).data;
  } catch {
    return demoBranding;
  }
}

export async function getCourses(): Promise<PublicCourse[]> {
  try {
    const response = await fetch(`${apiUrl}/public/courses?pageSize=50`, { next: { revalidate: 120 } });
    if (!response.ok) throw new Error("Courses request failed");
    return (await response.json() as CourseListResponse).data;
  } catch {
    return demoCourses;
  }
}

export async function getCourse(slug: string): Promise<PublicCourse | undefined> {
  try {
    const response = await fetch(`${apiUrl}/public/courses/${slug}`, { next: { revalidate: 120 } });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error("Course request failed");
    return (await response.json() as { data: PublicCourse }).data;
  } catch {
    return demoCourses.find((course) => course.slug === slug);
  }
}

export function formatPrice(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}
