import type { SVGProps } from "react";
type Props = SVGProps<SVGSVGElement>;
const base = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
export const Icons = {
  dashboard: (p: Props) => <svg {...base} {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  students: (p: Props) => <svg {...base} {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  courses: (p: Props) => <svg {...base} {...p}><path d="m4 19.5 8-4 8 4M4 4.5l8 4 8-4-8-4Z"/><path d="m4 9.5 8 4 8-4"/></svg>,
  video: (p: Props) => <svg {...base} {...p}><rect x="3" y="5" width="15" height="14" rx="2"/><path d="m18 10 4-2v8l-4-2z"/></svg>,
  orders: (p: Props) => <svg {...base} {...p}><path d="M6 2h12l2 5H4zM5 7v15h14V7"/><path d="M9 11h6"/></svg>,
  coupon: (p: Props) => <svg {...base} {...p}><path d="M20 12a2 2 0 0 0 0-4V5H4v3a2 2 0 0 0 0 4v3a2 2 0 0 0 0 4v2h16v-2a2 2 0 0 0 0-4z"/><path d="M12 5v16"/></svg>,
  reviews: (p: Props) => <svg {...base} {...p}><path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"/></svg>,
  content: (p: Props) => <svg {...base} {...p}><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>,
  email: (p: Props) => <svg {...base} {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>,
  settings: (p: Props) => <svg {...base} {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 3.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2V9h.09A1.7 1.7 0 0 0 3.64 7.9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8 3.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2H14v.09A1.7 1.7 0 0 0 15.1 3.64a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 20.4 8c.1.4.3.73.6 1 .3.27.7.4 1.1.4h.09V14h-.09A1.7 1.7 0 0 0 20.36 15z"/></svg>,
  search: (p: Props) => <svg {...base} {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>,
  bell: (p: Props) => <svg {...base} {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>,
  chevron: (p: Props) => <svg {...base} {...p}><path d="m9 18 6-6-6-6"/></svg>,
  plus: (p: Props) => <svg {...base} {...p}><path d="M12 5v14M5 12h14"/></svg>,
};
