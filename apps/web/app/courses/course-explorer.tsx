"use client";

import { useMemo, useState } from "react";
import type { PublicCourse } from "@tutor/contracts";
import { CourseCard } from "../../components/course-card";
import { Search } from "../../components/icons";

export function CourseExplorer({ courses }: { courses: PublicCourse[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const categories = ["All", ...Array.from(new Set(courses.map((course) => course.category)))];

  const filtered = useMemo(() => courses.filter((course) => {
    const matchesCategory = category === "All" || course.category === category;
    const haystack = `${course.title} ${course.category} ${course.level} ${course.shortDescription}`.toLocaleLowerCase();
    return matchesCategory && haystack.includes(query.toLocaleLowerCase());
  }), [category, courses, query]);

  return (
    <>
      <div className="catalog-tools">
        <div className="category-tabs" role="tablist" aria-label="Course categories">
          {categories.map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
        <label className="search-field"><Search /><span className="sr-only">Search courses</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses" /></label>
      </div>
      <div className="catalog-count">Showing <strong>{filtered.length}</strong> {filtered.length === 1 ? "course" : "courses"}</div>
      {filtered.length ? <div className="course-grid catalog-grid">{filtered.map((course, index) => <CourseCard key={course.id} course={course} index={index} />)}</div> : <div className="empty-state"><h2>No courses found</h2><p>Try a different search or category.</p><button className="inline-link" onClick={() => { setQuery(""); setCategory("All"); }}>Clear filters</button></div>}
    </>
  );
}
