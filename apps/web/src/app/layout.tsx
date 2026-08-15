import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ColabCode - Real-Time Collaborative Code Editor",
  description:
    "A production-grade real-time collaborative code editor for teams to work together seamlessly",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
