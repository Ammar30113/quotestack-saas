import AppShell from "@/components/AppShell";

export default function Loading() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="card space-y-3 p-6 text-center">
          <div className="text-lg font-semibold text-white">Loading...</div>
          <p className="text-sm text-slate-400">Please wait a moment.</p>
        </div>
      </div>
    </AppShell>
  );
}
