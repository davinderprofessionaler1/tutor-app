import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../components/site-footer";
import { SiteHeader } from "../../../components/site-header";
import { ArrowRight, Check, Clock, Lock, Play, Star } from "../../../components/icons";
import { formatPrice, getBranding, getCourse } from "../../../lib/api";

type CoursePageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourse(slug);
  return course ? { title: course.title, description: course.shortDescription } : { title: "Course not found" };
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { slug } = await params;
  const [branding, course] = await Promise.all([getBranding(), getCourse(slug)]);
  if (!course) notFound();

  return (
    <main>
      <SiteHeader branding={branding} />
      <section className={`course-hero course-hero-${course.accent}`}>
        <div className="shell course-hero-grid">
          <div>
            <div className="breadcrumb"><Link href="/courses">Courses</Link><span>/</span><span>{course.category}</span></div>
            <div className="course-badges"><span>{course.category}</span><span>{course.level}</span></div>
            <h1>{course.title}</h1>
            <p>{course.shortDescription}</p>
            <div className="course-social-proof"><strong><Star width={17} height={17} fill="currentColor" /> {course.rating}</strong><span>{course.reviewCount} reviews</span><span>{course.studentCount.toLocaleString("en-IN")} students</span></div>
            <div className="taught-by"><span>AM</span><div><small>Taught by</small><strong>{branding.tutorName}</strong></div></div>
          </div>
          <aside className="purchase-card">
            <div className={`purchase-preview course-art-${course.accent}`}><span>{course.category}</span><button aria-label="Play course preview"><Play width={29} height={29} /></button><small>Watch preview · 2:14</small></div>
            <div className="purchase-body">
              <div className="purchase-price"><strong>{formatPrice(course.salePrice, course.currency)}</strong><s>{formatPrice(course.originalPrice, course.currency)}</s><span>{Math.round((1 - course.salePrice / course.originalPrice) * 100)}% off</span></div>
              <button className="button button-coral button-wide">Enroll now <ArrowRight /></button>
              <small className="purchase-note">Secure checkout · 7-day refund policy</small>
              <ul><li><Clock /> {course.durationHours} hours of focused video</li><li><Play /> {course.lessonCount} practical lessons</li><li><Check /> {course.access} course access</li><li><Check /> Learn on web and mobile</li></ul>
            </div>
          </aside>
        </div>
      </section>

      <section className="course-content shell">
        <div className="course-main">
          <div className="content-section"><div className="eyebrow"><span /> What you will learn</div><h2>Leave with a clearer way to work.</h2><div className="outcome-grid">{course.outcomes.map((outcome) => <div key={outcome}><span><Check /></span><p>{outcome}</p></div>)}</div></div>
          <div className="content-section curriculum"><div className="eyebrow"><span /> Course curriculum</div><h2>A practical path, step by step.</h2><div className="curriculum-meta"><span>{course.sections.length} modules</span><span>{course.lessonCount} lessons</span><span>{course.durationHours} hours</span></div>
            <div className="module-list">
              {course.sections.length ? course.sections.map((section, sectionIndex) => <article key={section.id}><header><span>{String(sectionIndex + 1).padStart(2, "0")}</span><div><small>Module {sectionIndex + 1}</small><h3>{section.title}</h3></div><small>{section.lessons.length} lessons</small></header><div>{section.lessons.map((lesson) => <div className="lesson-row" key={lesson.id}><span>{lesson.isPreview ? <Play /> : <Lock />}</span><strong>{lesson.title}</strong>{lesson.isPreview && <button>Preview</button>}<small>{lesson.durationMinutes} min</small></div>)}</div></article>) : <article className="curriculum-coming"><h3>Full curriculum coming shortly</h3><p>Join the early access list to be notified when enrollment opens.</p></article>}
            </div>
          </div>
        </div>
        <aside className="course-side"><strong>This course is for you if...</strong><ul><li><Check /> You want a repeatable approach, not more inspiration.</li><li><Check /> You learn best through concrete examples.</li><li><Check /> You want to make confident decisions sooner.</li></ul><hr /><strong>Need help deciding?</strong><p>Tell us what you are working through and we’ll point you in the right direction.</p><a href={`mailto:${branding.supportEmail}`}>Email {branding.supportEmail}</a></aside>
      </section>
      <SiteFooter branding={branding} />
    </main>
  );
}
