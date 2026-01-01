export type WorkflowActions = {
  canApplyAI: boolean;
  canRequestReview: boolean;
  canOverride: boolean;
  canApprove: boolean;
  canFile: boolean;
};

export type TaxCaseDetail = {
  id: string;
  workflowStage: string;
  actions: WorkflowActions;
};