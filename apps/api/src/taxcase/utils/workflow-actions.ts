// taxcase/utils/workflow-actions.ts
import { WorkflowStage } from '@prisma/client';
import { WorkflowActions } from '../types/workflow-actions.type';

export function getWorkflowActions(
  stage: WorkflowStage | null,
): WorkflowActions {
 /*   
  switch (stage) {
    case WorkflowStage.UPLOADED:
      return {
        canApplyAI: true,
        canRequestReview: false,
        canOverride: false,
        canApprove: false,
        canFile: false,
      };

    case WorkflowStage.AI_ANALYZED:
      return {
        canApplyAI: false,
        canRequestReview: true,
        canOverride: false,
        canApprove: false,
        canFile: false,
      };

    case WorkflowStage.HUMAN_REVIEW:
      return {
        canApplyAI: false,
        canRequestReview: false,
        canOverride: true,
        canApprove: true,
        canFile: false,
      };

    case WorkflowStage.APPROVED:
      return {
        canApplyAI: false,
        canRequestReview: false,
        canOverride: false,
        canApprove: false,
        canFile: true,
      };

    case WorkflowStage.FILED:
      return {
        canApplyAI: false,
        canRequestReview: false,
        canOverride: false,
        canApprove: false,
        canFile: false,
      };

    default:
      return {
        canApplyAI: false,
        canRequestReview: false,
        canOverride: false,
        canApprove: false,
        canFile: false,
      };
      */
  return {
    canApplyAI: stage === WorkflowStage.UPLOADED,
    canRequestReview: stage === WorkflowStage.AI_ANALYZED,
    canOverride: stage === WorkflowStage.HUMAN_REVIEW,
    canApprove: stage === WorkflowStage.HUMAN_REVIEW,
    canFile: stage === WorkflowStage.APPROVED,
  };

}