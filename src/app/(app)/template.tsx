"use client";

// Re-mounts on every route change (unlike layout.tsx), giving each page a
// subtle fade-up entrance. Purely visual — renders children untouched.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-enter">{children}</div>;
}
