export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
        <div className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}

