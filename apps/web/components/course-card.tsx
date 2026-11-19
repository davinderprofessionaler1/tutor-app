import Link from "next/link";
import type { PublicCourse } from "@tutor/contracts";
import { ArrowUpRight, Star } from "./icons";
import { formatPrice } from "../lib/api";

export function CourseCard({ course, index = 0 }: { course: PublicCourse; index?: number }) {
  const courseNumber = String(index + 1).padStart(2, "0");
  return (
    <article className="course-card">
      <Link className={`course-art course-art-${course.accent}`} href={`/courses/${course.slug}`} aria-label={`View ${course.title}`}>
        <span className="course-number">{courseNumber}</span>
        <span className="course-art-title">{course.category}<br />course</span>
        <span className="course-art-orbit" aria-hidden="true"><i /><i /></span>
        <span className="course-art-arrow"><ArrowUpRight /></span>
      </Link>
      <div className="course-card-body">
        <div className="course-meta"><span>{course.category}</span><span>{course.level}</span><span>{course.durationHours} hours</span></div>
        <h3><Link href={`/courses/${course.slug}`}>{course.title}</Link></h3>
        <p>{course.shortDescription}</p>
        <div className="course-card-footer">
          <div className="price"><strong>{formatPrice(course.salePrice, course.currency)}</strong><s>{formatPrice(course.originalPrice, course.currency)}</s></div>
          <div className="rating"><Star width={16} height={16} fill="currentColor" /> {course.rating} <span>({course.reviewCount})</span></div>
        </div>
      </div>
    </article>
  );
}
