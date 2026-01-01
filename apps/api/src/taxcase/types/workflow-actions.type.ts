// taxcase/types/workflow-actions.type.ts
export interface WorkflowActions {
  canApplyAI: boolean;
  canRequestReview: boolean;
  canOverride: boolean;
  canApprove: boolean;
  canFile: boolean;
}