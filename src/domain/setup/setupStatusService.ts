/**
 * Setup status service — re-exports for consumers that prefer a service entry point.
 * Server loaders should use `getSetupHubSnapshot` from `@/data/setup-status`.
 */
export {
  buildSetupHubSnapshot,
  evaluateAllSetupModules,
  evaluateSetupModule,
  pickRecommendedSetupStep,
  summarizeSetupProgress,
} from "@/domain/setup/evaluators";
export type { SetupEvaluationContext } from "@/domain/setup/context";
export {
  SETUP_MODULES,
  SETUP_MODULE_BY_ID,
  SETUP_RECOMMENDATION_PRIORITY,
} from "@/domain/setup/modules";
export type {
  SetupHubSnapshot,
  SetupModuleEvaluation,
  SetupModuleId,
  SetupModuleStatus,
  SetupProgressSummary,
  SetupRecommendedStep,
} from "@/domain/setup/types";
