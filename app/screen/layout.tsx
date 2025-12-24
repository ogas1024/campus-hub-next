export default function ScreenLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-[100dvh] w-full overflow-hidden bg-background">{children}</div>;
}
