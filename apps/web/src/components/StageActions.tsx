import { Button } from './ui';
import { STAGE_ACTIONS } from '../domain/taxCaseWorkflow';

interface Props {
  stage: string;
  loading?: boolean;
  onAction: (action: string) => void;
}

export default function StageActions({
  stage,
  loading,
  onAction,
}: Props) {
  const actions = STAGE_ACTIONS[stage] ?? [];

  if (actions.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No actions available for this stage.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {actions.map((a) => (
        <Button
          key={a.action}
          disabled={loading}
          variant={a.variant === 'secondary' ? 'outline' : 'default'}
          onClick={() => onAction(a.action)}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}