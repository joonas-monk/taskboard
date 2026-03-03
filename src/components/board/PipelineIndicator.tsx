'use client'

const STATUS_LABELS: Record<string, string> = {
  QUEUED: 'Jonossa',
  PLANNING: 'Suunnitellaan',
  AWAITING_APPROVAL: 'Odottaa',
  EXECUTING: 'Toteutetaan',
  AWAITING_EXEC_REVIEW: 'Tarkistus',
  BUILDING: 'Rakennetaan',
  TESTING: 'Testataan',
  TEST_FAILED: 'Hylatty',
  DEPLOYING: 'Julkaistaan',
  COMPLETED: 'Valmis',
  FAILED: 'Virhe',
  PAUSED: 'Pysaytetty',
}

const ACTIVE_STATUSES = new Set(['QUEUED', 'PLANNING', 'EXECUTING', 'BUILDING', 'TESTING', 'DEPLOYING'])

// Progress as fraction: 0–1
const STATUS_PROGRESS: Record<string, number> = {
  QUEUED: 0.05,
  PLANNING: 0.2,
  AWAITING_APPROVAL: 0.25,
  EXECUTING: 0.45,
  AWAITING_EXEC_REVIEW: 0.5,
  BUILDING: 0.6,
  TESTING: 0.75,
  TEST_FAILED: 0.75,
  DEPLOYING: 0.9,
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

  const color = isActive
    ? '#007AFF'
    : status === 'AWAITING_APPROVAL' || status === 'AWAITING_EXEC_REVIEW'
    ? '#FF9500'
    : status === 'COMPLETED'
    ? '#34C759'
    : status === 'FAILED' || status === 'TEST_FAILED'
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
        {status === 'TEST_FAILED' && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
            <path d="M3 3L9 9M9 3L3 9" stroke="#FF3B30" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
        {(status === 'AWAITING_APPROVAL' || status === 'AWAITING_EXEC_REVIEW') && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
            <circle cx="6" cy="6" r="4.5" stroke="#FF9500" strokeWidth="1.2"/>
            <path d="M6 3.5V6.5L8 8" stroke="#FF9500" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        )}
        {status === 'DEPLOYING' && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
            <path d="M6 2V10M6 2L3 5M6 2L9 5" stroke="#007AFF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
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
