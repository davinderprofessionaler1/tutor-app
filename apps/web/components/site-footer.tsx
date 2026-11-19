import Link from "next/link";
import type { PublicBranding } from "@tutor/contracts";
import { ArrowUpRight } from "./icons";

export function SiteFooter({ branding }: { branding: PublicBranding }) {
  return (
    <footer className="footer">
      <div className="shell footer-top">
        <div>
          <Link className="brand brand-inverse" href="/">
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
            <span>{branding.siteName}</span>
          </Link>
          <p>Practical courses for thoughtful people building meaningful work.</p>
        </div>
        <div className="footer-links">
          <div><strong>Learn</strong><Link href="/courses">All courses</Link><Link href="/#approach">How it works</Link><Link href="/login">Student sign in</Link></div>
          <div><strong>Company</strong><Link href="/#about">About the tutor</Link><Link href="/#stories">Student stories</Link><a href={`mailto:${branding.supportEmail}`}>Contact</a></div>
          <div><strong>Legal</strong><Link href="#">Privacy</Link><Link href="#">Terms</Link><Link href="#">Refund policy</Link></div>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© 2026 {branding.siteName}</span>
        <a href={`mailto:${branding.supportEmail}`}>{branding.supportEmail} <ArrowUpRight width={14} height={14} /></a>
      </div>
    </footer>
  );
}
