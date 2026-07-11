import { redirect } from "next/navigation";

/** Planning layout is unused — section pages redirect into Setup. */
export default function PlanningLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
