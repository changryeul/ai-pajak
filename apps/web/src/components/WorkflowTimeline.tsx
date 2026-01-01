import { Card, CardHeader, CardContent, Badge } from './ui';
import { WorkflowHistoryItem } from '../types/workflow';

type Props = {
  history: WorkflowHistoryItem[];
};

export function WorkflowTimeline({ history }: Props) {
  return (
    <Card>
      <CardHeader title="Workflow History" />
      <CardContent>
        <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
          {history.map((h, idx) => (
            <li
              key={idx}
              style={{
                display: 'flex',
                gap: 12,
                marginBottom: 12,
                alignItems: 'center',
              }}
            >
              <Badge>{h.stage}</Badge>
              <span style={{ color: '#666' }}>
                {new Date(h.changedAt).toLocaleString()}
              </span>
              {h.actorId && (
                <span style={{ color: '#999' }}>
                  by user #{h.actorId}
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}