'use client'

const STATUS_LABELS: Record<string, string> = {
  QUEUED: 'Jonossa',
  PLANNING: 'Suunnitellaan',
  AWAITING_APPROVAL: 'Odottaa',
  EXECUTING: 'Toteutetaan',
  TESTING: 'Testataan',
  COMPLETED: 'Valmis',
  FAILED: 'Virhe',
  PAUSED: 'Pysaytetty',
}

const ACTIVE_STATUSES = new Set(['QUEUED', 'PLANNING', 'EXECUTING', 'TESTING'])

// Progress as fraction: 0–1
const STATUS_PROGRESS: Record<string, number> = {
  QUEUED: 0.05,
  PLANNING: 0.25,
  AWAITING_APPROVAL: 0.3,
  EXECUTING: 0.6,
  TESTING: 0.85,
  COMPLETED: 1,
  FAILED: 0,
  PAUSED: 0,
}

interface Props {
  status: string
}

export default function PipelineIndicator({ status }: Props) {
  if (status === 'IDLE') return null

  const isActive = ACTIVE_STATUSES.has(status)
  const label = STATUS_LABELS[status] ?? status
  const progress = STATUS_PROGRESS[status] ?? 0

  const color = isActive || status === 'AWAITING_APPROVAL'
    ? '#007AFF'
    : status === 'COMPLETED'
    ? '#34C759'
    : status === 'FAILED'
    ? '#FF3B30'
    : '#8E8E93'

  return (
    <div className="flex flex-col gap-1.5 mt-1">
      <div className="flex items-center gap-1.5">
        {isActive && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ backgroundColor: color }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: color }} />
          </span>
        )}
        {status === 'COMPLETED' && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
            <path d="M2 6.5L4.5 9L10 3" stroke="#34C759" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {status === 'FAILED' && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
            <path d="M3 3L9 9M9 3L3 9" stroke="#FF3B30" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
        <span className="text-[11px] font-semibold" style={{ color }}>{label}</span>
      </div>
      {/* Progress bar */}
      {progress > 0 && (
        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isActive ? 'animate-pulse' : ''}`}
            style={{ width: `${progress * 100}%`, backgroundColor: color }}
          />
        </div>
      )}
    </div>
  )
}
