/** Lifecycle state for a single setup module (MVP rules; extend per module).
 * `pending` is a nav-only signal (advisor proposal awaiting client action); it
 * never participates in progress math. */
export type SetupModuleStatus =
  | "complete"
  | "partial"
  | "not_started"
  | "pending";

export type SetupModuleGroupId =
  | "core"
  | "protection"
  | "future"
  | "advisor_system";

export type SetupModuleId =
  | "profile"
  | "income_expenses"
  | "loans"
  | "emergency_funds"
  | "insurance"
  | "dependents"
  | "estate"
  | "investments"
  | "retirement"
  | "cpf"
  | "goals"
  | "risk_profile"
  | "documents"
  | "advisor_proposal";

export type SetupModuleEvaluation = {
  moduleId: SetupModuleId;
  status: SetupModuleStatus;
  /** 0–100 weight for overall progress bar */
  completionPercentage: number;
  /** ISO timestamp from underlying records, when known */
  lastUpdatedAt: string | null;
  /** Human-readable gaps for future advisor tooling */
  missingFields: string[];
};

export type SetupProgressSummary = {
  completionPercent: number;
  completedCount: number;
  remainingCount: number;
  totalCount: number;
};

export type SetupRecommendedStep = {
  moduleId: SetupModuleId;
  title: string;
  reason: string;
  href: string;
  ctaLabel: string;
};

/**
 * Serializable hub snapshot — same shape for self-serve and future advisor client views.
 */
export type SetupHubSnapshot = {
  subjectUserId: string;
  evaluatedAt: string;
  progress: SetupProgressSummary;
  modules: SetupModuleEvaluation[];
  recommended: SetupRecommendedStep | null;
};
