const STAGES = [
  'UPLOADED',
  'AI_ANALYZED',
  'HUMAN_REVIEW',
  'APPROVED',
  'FILED',
];

interface Props {
  stage: string;
}

export default function StageProgress({ stage }: Props) {
  const currentIndex = STAGES.indexOf(stage);

  return (
    <div className="flex items-center gap-4 py-4">
      {STAGES.map((s, idx) => {
        const isActive = idx <= currentIndex;

        return (
          <div key={s} className="flex items-center gap-2">
            <div
              className={
                `h-3 w-3 rounded-full transition-colors ` +
                (isActive ? 'bg-blue-500' : 'bg-slate-700')
              }
            />
            <span
              className={
                `text-xs font-semibold ` +
                (isActive ? 'text-blue-400' : 'text-slate-500')
              }
            >
              {s.replace('_', ' ')}
            </span>

            {idx < STAGES.length - 1 && (
              <div
                className={
                  `w-8 h-px mx-2 ` +
                  (isActive ? 'bg-blue-500' : 'bg-slate-700')
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}