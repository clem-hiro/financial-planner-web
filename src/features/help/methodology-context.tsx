"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MethodologyTopicId } from "@/content/methodology-topics";

export type MethodologyContextValue = {
  isOpen: boolean;
  activeTopicId: MethodologyTopicId | null;
  openMethodology: (topicId?: MethodologyTopicId | null) => void;
  closeMethodology: () => void;
};

const MethodologyContext = createContext<MethodologyContextValue | null>(
  null
);

export function MethodologyProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [activeTopicId, setActiveTopicId] = useState<MethodologyTopicId | null>(
    null
  );

  const openMethodology = useCallback(
    (topicId?: MethodologyTopicId | null) => {
      setActiveTopicId(topicId ?? null);
      setOpen(true);
    },
    []
  );

  const closeMethodology = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      activeTopicId,
      openMethodology,
      closeMethodology,
    }),
    [isOpen, activeTopicId, openMethodology, closeMethodology]
  );

  return (
    <MethodologyContext.Provider value={value}>
      {children}
    </MethodologyContext.Provider>
  );
}

export function useMethodology(): MethodologyContextValue {
  const ctx = useContext(MethodologyContext);
  if (!ctx) {
    throw new Error("useMethodology must be used within MethodologyProvider");
  }
  return ctx;
}
