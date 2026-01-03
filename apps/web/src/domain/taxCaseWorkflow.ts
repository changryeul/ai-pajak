export const STAGE_ACTIONS: Record<string, {
  label: string;
  action: string;
  variant?: 'primary' | 'secondary' | 'danger';
}>[] = {
  AI_ANALYZED: [
    {
      label: 'Move to Human Review',
      action: 'MOVE_TO_HUMAN_REVIEW',
      variant: 'primary',
    },
  ],

  HUMAN_REVIEW: [
    {
      label: 'Approve',
      action: 'APPROVE',
      variant: 'primary',
    },
    {
      label: 'Request Re-AI',
      action: 'RETRY_AI',
      variant: 'secondary',
    },
  ],

  APPROVED: [
    {
      label: 'File Tax Case',
      action: 'FILE',
      variant: 'primary',
    },
  ],

  FILED: [],
};