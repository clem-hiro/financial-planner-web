import { AdvisorWorkspaceSidebar } from "@/features/advisor/AdvisorWorkspaceSidebar";

export default function AdvisorRoutesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <AdvisorWorkspaceSidebar />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
