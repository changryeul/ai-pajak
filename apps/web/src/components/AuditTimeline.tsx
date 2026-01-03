interface Props {
  logs?: any[];
}

export default function AuditTimeline({ logs = [] }: Props) {
  if (logs.length === 0) {
    return (
      <div className="text-sm text-slate-400">
        No audit history yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log, idx) => (
        <div key={idx} className="text-sm">
          {log.message}
        </div>
      ))}
    </div>
  );
}