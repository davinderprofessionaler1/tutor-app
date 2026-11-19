import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Northstar Learning", template: "%s | Northstar Learning" },
  description: "Practical courses for thoughtful people building meaningful work.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
