"use client";

import type { MethodologyTopicId } from "@/content/methodology-topics";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { useMethodology } from "./methodology-context";

export function MethodologyOpenLink({
  topicId,
  children,
  className,
}: {
  topicId: MethodologyTopicId;
  children: React.ReactNode;
  className?: string;
}) {
  const { openMethodology } = useMethodology();
  return (
    <button
      type="button"
      className={className ?? `text-left text-sm ${appInlineLinkClass}`}
      onClick={() => openMethodology(topicId)}
    >
      {children}
    </button>
  );
}
