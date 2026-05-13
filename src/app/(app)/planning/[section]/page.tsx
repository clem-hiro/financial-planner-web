import { notFound } from "next/navigation";
import { isPlanningSectionId } from "@/lib/planning-sections";
import { CashFlowPlanningSection } from "@/features/planning/sections/CashFlowPlanningSection";
import { FuturePlanningSection } from "@/features/planning/sections/FuturePlanningSection";
import { OverviewPlanningSection } from "@/features/planning/sections/OverviewPlanningSection";
import { ProtectionPlanningSection } from "@/features/planning/sections/ProtectionPlanningSection";
import { WealthPlanningSection } from "@/features/planning/sections/WealthPlanningSection";

type PageProps = {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
};

export default async function PlanningSectionPage({
  params,
  searchParams,
}: PageProps) {
  const { section } = await params;
  if (!isPlanningSectionId(section)) notFound();

  if (section === "overview") return <OverviewPlanningSection />;
  if (section === "cash-flow") {
    return <CashFlowPlanningSection searchParams={searchParams} />;
  }
  if (section === "wealth") return <WealthPlanningSection />;
  if (section === "protection") return <ProtectionPlanningSection />;
  return <FuturePlanningSection />;
}
