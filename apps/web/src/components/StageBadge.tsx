const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  AI_ANALYZED: { label: 'AI Analyzed', color: 'bg-blue-100 text-blue-700' },
  HUMAN_REVIEW: { label: 'Human Review', color: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700' },
  FILED: { label: 'Filed', color: 'bg-slate-200 text-slate-700' },
};
export default function StageBadge({ stage }: { stage?: string }) {
  const config = stage ? STAGE_CONFIG[stage] : null;

  if (!config) {
    return (
      <span className="px-3 py-1 rounded-full bg-gray-200 text-gray-600 text-xs">
        UNKNOWN
      </span>
    );
  }

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${config.color}`}
    >
      {config.label}
    </span>
  );
}