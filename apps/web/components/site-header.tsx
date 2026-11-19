import Link from "next/link";
import type { PublicBranding } from "@tutor/contracts";
import { ArrowUpRight } from "./icons";

export function SiteHeader({ branding }: { branding: PublicBranding }) {
  return (
    <>
      <div className="announcement">
        <span>{branding.announcement}</span>
        <Link href="/courses">Explore courses <ArrowUpRight width={15} height={15} /></Link>
      </div>
      <header className="site-header shell">
        <Link className="brand" href="/" aria-label={`${branding.siteName} home`}>
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>{branding.siteName}</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/courses">Courses</Link>
          <Link href="/#approach">How it works</Link>
          <Link href="/#about">About</Link>
          <Link href="/#stories">Stories</Link>
        </nav>
        <div className="header-actions">
          <Link className="text-link" href="/login">Sign in</Link>
          <Link className="button button-dark button-small" href="/courses">Start learning <ArrowUpRight width={17} height={17} /></Link>
        </div>
      </header>
    </>
  );
}
