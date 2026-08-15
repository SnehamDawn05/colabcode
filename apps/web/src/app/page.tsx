import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-5xl font-extrabold tracking-tight">ColabCode</h1>
        <p className="text-xl text-foreground/70">
          Real-time collaborative code editor for teams to build, debug, and share code seamlessly.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            href="/auth/login"
            className="px-6 py-3 bg-primary text-background font-semibold rounded-lg hover:opacity-90 transition"
          >
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="px-6 py-3 bg-secondary/80 border border-border font-semibold rounded-lg hover:bg-secondary transition"
          >
            Create Account
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 border border-border text-foreground/80 font-semibold rounded-lg hover:bg-secondary/40 transition"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
