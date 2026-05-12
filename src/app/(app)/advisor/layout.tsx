import { AdvisorWorkspaceSidebar } from "@/features/advisor/AdvisorWorkspaceSidebar";

export default function AdvisorRoutesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
      <div className="lg:sticky lg:top-24">
        <AdvisorWorkspaceSidebar />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
