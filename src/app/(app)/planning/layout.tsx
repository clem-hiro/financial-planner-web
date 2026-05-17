import { PlanningLayoutShell } from "@/features/planning/PlanningLayoutShell";

export default function PlanningLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PlanningLayoutShell>{children}</PlanningLayoutShell>;
}
