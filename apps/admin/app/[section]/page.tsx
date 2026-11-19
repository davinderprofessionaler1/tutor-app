import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Icons } from "../../components/icons";
import { Topbar } from "../../components/topbar";

const sections = {
  students: { title: "Students", subtitle: "Search learners, manage access, and review progress.", description: "Student profiles, manual course assignment, expiry controls, and progress history are planned for the next implementation slice.", action: "Add student", icon: Icons.students },
  videos: { title: "Video library", subtitle: "Manage protected course media and lesson assets.", description: "Uploads, streaming status, thumbnails, download controls, and course assignment will live here.", action: "Upload video", icon: Icons.video },
  orders: { title: "Orders", subtitle: "Review purchases, payments, refunds, and enrollment status.", description: "The order ledger will combine payment provider events with enrollment outcomes and customer support context.", action: "Export orders", icon: Icons.orders },
  coupons: { title: "Coupons", subtitle: "Create targeted promotions with clear usage controls.", description: "Percentage and fixed discounts, course eligibility, validity periods, and usage history will be managed here.", action: "New coupon", icon: Icons.coupon },
  content: { title: "Website content", subtitle: "Keep public pages current without a code deployment.", description: "Structured home sections, testimonials, legal pages, FAQs, and contact details will be editable here.", action: "New page", icon: Icons.content },
  email: { title: "Email templates", subtitle: "Manage transactional messages and delivery settings.", description: "Editable subjects, content blocks, calls to action, variables, and send history will be managed here.", action: "New template", icon: Icons.email },
} as const;

type SectionKey = keyof typeof sections;
type SectionPageProps = { params: Promise<{ section: string }> };

function isSectionKey(value: string): value is SectionKey {
  return value in sections;
}

export function generateStaticParams() {
  return Object.keys(sections).map((section) => ({ section }));
}

export async function generateMetadata({ params }: SectionPageProps): Promise<Metadata> {
  const { section } = await params;
  return { title: isSectionKey(section) ? sections[section].title : "Not found" };
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { section } = await params;
  if (!isSectionKey(section)) notFound();
  const config = sections[section];
  const Icon = config.icon;

  return <>
    <Topbar title={config.title} subtitle={config.subtitle} action={<button className="primary-action"><Icons.plus /> {config.action}</button>} />
    <div className="page-content">
      <section className="panel module-placeholder">
        <span className="module-icon"><Icon /></span>
        <div><small>Core module</small><h2>{config.title} workspace</h2><p>{config.description}</p></div>
        <div className="module-roadmap"><span className="active">01</span><i /><span>02</span><i /><span>03</span></div>
        <footer><strong>Foundation ready</strong><span>The navigation and data model for this module are already included in the platform architecture.</span></footer>
      </section>
    </div>
  </>;
}
