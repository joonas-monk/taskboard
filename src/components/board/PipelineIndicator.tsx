'use client'

const STATUS_LABELS: Record<string, string> = {
  QUEUED: 'Jonossa...',
  PLANNING: 'Suunnitellaan...',
  EXECUTING: 'Toteutetaan...',
  TESTING: 'Testataan...',
  COMPLETED: 'Valmis',
  FAILED: 'Virhe',
  PAUSED: 'Pysaytetty',
}

const ACTIVE_STATUSES = new Set(['QUEUED', 'PLANNING', 'EXECUTING', 'TESTING'])

interface Props {
  status: string
}

export default function PipelineIndicator({ status }: Props) {
  if (status === 'IDLE') return null

  const isActive = ACTIVE_STATUSES.has(status)
  const label = STATUS_LABELS[status] ?? status

  return (
    <div className="flex items-center gap-1.5 text-xs mt-1">
      {isActive && (
        <span
          className="w-3 h-3 rounded-full border-2 animate-spin shrink-0"
          style={{ borderColor: '#3b82f6', borderTopColor: 'transparent' }}
        />
      )}
      <span
        style={{
          color: isActive
            ? '#3b82f6'
            : status === 'COMPLETED'
            ? '#16a34a'
            : status === 'FAILED'
            ? '#dc2626'
            : '#6b7280',
        }}
      >
        {label}
      </span>
    </div>
  )
}
