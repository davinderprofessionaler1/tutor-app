import Link from "next/link";
import { CourseCard } from "../components/course-card";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { ArrowRight, ArrowUpRight, Check, Play, Star } from "../components/icons";
import { getBranding, getCourses } from "../lib/api";

export default async function HomePage() {
  const [branding, courses] = await Promise.all([getBranding(), getCourses()]);
  const featured = courses.filter((course) => course.featured).slice(0, 3);

  return (
    <main>
      <SiteHeader branding={branding} />

      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow"><span /> Learn with direction</div>
          <h1>Clarity for the work that <em>matters.</em></h1>
          <p className="hero-intro">Focused, practical courses designed to help you think better, communicate clearly, and lead work you are proud of.</p>
          <div className="hero-actions">
            <Link className="button button-coral" href="/courses">Browse all courses <ArrowRight /></Link>
            <a className="watch-link" href="#about"><span><Play /></span> Meet your tutor</a>
          </div>
          <div className="hero-proof">
            <div className="avatar-stack" aria-label="Student community"><span>SM</span><span>RK</span><span>AP</span><span>+2k</span></div>
            <div><strong>4.9 <Star width={14} height={14} fill="currentColor" /></strong><small>Loved by 2,400+ learners</small></div>
          </div>
        </div>
        <div className="hero-visual" aria-label="Learning dashboard preview">
          <div className="hero-grid" />
          <div className="portrait-card">
            <div className="portrait-shape"><span>AM</span></div>
            <div className="portrait-caption"><span>Your tutor</span><strong>{branding.tutorName}</strong><small>Product leader · Educator</small></div>
          </div>
          <div className="floating-note note-one"><span>Next lesson</span><strong>Choosing what matters</strong><div><i style={{ width: "68%" }} /></div><small>68% complete</small></div>
          <div className="floating-note note-two"><strong>4.9</strong><span>average rating</span><div className="stars">★★★★★</div></div>
          <span className="scribble scribble-one" aria-hidden="true">↗</span>
          <span className="scribble scribble-two" aria-hidden="true">✦</span>
        </div>
      </section>

      <section className="trust-strip">
        <div className="shell trust-inner">
          <span>Built for people at</span>
          <strong>Razorpay</strong><strong>Notion</strong><strong>Atlassian</strong><strong>Stripe</strong><strong>Freshworks</strong>
        </div>
      </section>

      <section className="section shell" id="courses">
        <div className="section-heading split-heading">
          <div><div className="eyebrow"><span /> Popular courses</div><h2>Learn what moves<br />your work forward.</h2></div>
          <div><p>No filler. No endless theory. Each course gives you tools, examples, and a clear path from insight to action.</p><Link className="inline-link" href="/courses">Explore the full library <ArrowUpRight /></Link></div>
        </div>
        <div className="course-grid">
          {featured.map((course, index) => <CourseCard key={course.id} course={course} index={index} />)}
        </div>
      </section>

      <section className="approach" id="approach">
        <div className="shell approach-grid">
          <div className="approach-intro">
            <div className="eyebrow eyebrow-light"><span /> A better way to learn</div>
            <h2>Built for busy minds and real work.</h2>
            <p>Progress should feel energizing, not overwhelming. Learn in short, thoughtful sessions and return exactly where you left off.</p>
            <Link className="button button-light" href="/courses">Find your course <ArrowRight /></Link>
          </div>
          <div className="approach-steps">
            {[
              ["01", "Learn at your pace", "Short lessons, lifetime access, and progress that follows you across devices."],
              ["02", "Practice with purpose", "Apply each idea through prompts and examples drawn from real working situations."],
              ["03", "Keep what works", "Return to frameworks, notes, and resources whenever the next challenge appears."],
            ].map(([number, title, copy]) => (
              <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div><ArrowUpRight /></article>
            ))}
          </div>
        </div>
      </section>

      <section className="section shell tutor-section" id="about">
        <div className="tutor-collage">
          <div className="tutor-photo"><div><span>AM</span></div></div>
          <div className="tutor-note">“Good teaching turns noise into a next step.”</div>
          <span className="tutor-doodle">↝</span>
        </div>
        <div className="tutor-copy">
          <div className="eyebrow"><span /> Meet your tutor</div>
          <h2>Experience, distilled into useful lessons.</h2>
          <p>I’m {branding.tutorName}, a product leader and educator. I’ve spent the last decade helping teams make better decisions under pressure. These courses contain the methods I wish someone had shown me earlier.</p>
          <ul><li><Check /> Practical frameworks, explained clearly</li><li><Check /> Real examples from modern teams</li><li><Check /> Direct answers without the theatre</li></ul>
          <Link className="inline-link" href="/courses">See what you can learn <ArrowUpRight /></Link>
        </div>
      </section>

      <section className="stories" id="stories">
        <div className="shell">
          <div className="section-heading centered"><div className="eyebrow"><span /> Student stories</div><h2>Small shifts. Meaningful change.</h2></div>
          <div className="story-grid">
            {([
              ["The course gave me a language for decisions I was already wrestling with. Monday morning felt different.", "Mira Shah", "Senior Product Manager"],
              ["I stopped polishing slides and started building an argument. The difference in the room was immediate.", "Rohan Kapoor", "Strategy Lead"],
              ["Thoughtful, specific, and refreshingly honest. I’ve returned to the templates every week since.", "Ananya Pillai", "Design Director"],
            ] as const).map(([quote, name, role], i) => (
              <article className={i === 1 ? "story-card story-featured" : "story-card"} key={name}>
                <div className="story-stars">★★★★★</div><blockquote>“{quote}”</blockquote><footer><span>{name.split(" ").map((part) => part[0]).join("")}</span><div><strong>{name}</strong><small>{role}</small></div></footer>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="newsletter shell">
        <div><div className="eyebrow eyebrow-light"><span /> Notes worth keeping</div><h2>One useful idea, every other Tuesday.</h2></div>
        <form><label className="sr-only" htmlFor="newsletter-email">Email address</label><input id="newsletter-email" type="email" placeholder="you@example.com" /><button className="button button-coral" type="submit">Join the list <ArrowRight /></button></form>
      </section>

      <SiteFooter branding={branding} />
    </main>
  );
}
