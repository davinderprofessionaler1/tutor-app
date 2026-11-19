import type { Metadata } from "next";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import { getBranding, getCourses } from "../../lib/api";
import { CourseExplorer } from "./course-explorer";

export const metadata: Metadata = { title: "Courses", description: "Browse practical courses in product, communication, leadership, and research." };

export default async function CoursesPage() {
  const [branding, courses] = await Promise.all([getBranding(), getCourses()]);
  return (
    <main>
      <SiteHeader branding={branding} />
      <section className="catalog-hero shell">
        <div className="eyebrow"><span /> Course library</div>
        <h1>Useful ideas for<br /><em>meaningful work.</em></h1>
        <p>Choose a focused course, learn at your pace, and leave with tools you can use the same day.</p>
      </section>
      <section className="catalog shell"><CourseExplorer courses={courses} /></section>
      <SiteFooter branding={branding} />
    </main>
  );
}
