'use client'

import { useEffect, useState } from 'react'
import { getPipelineStatus } from '@/actions/ai'
import type { SerializedPipelineRun } from '@/types'
import PipelineActions from './PipelineActions'

interface Props {
  cardId: string
  currentStatus: string
  onStatusChange: () => void
}

const STATUS_LABELS: Record<string, string> = {
  IDLE: 'Odottaa',
  QUEUED: 'Jonossa',
  PLANNING: 'Suunnitellaan',
  EXECUTING: 'Suoritetaan',
  TESTING: 'Testataan',
  COMPLETED: 'Valmis',
  FAILED: 'Epaonnistui',
  PAUSED: 'Pysaytetty',
}

const STAGE_LABELS: Record<string, string> = {
  PLANNING: 'Suunnittelu',
  EXECUTING: 'Suoritus',
  TESTING: 'Testaus',
}

function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat('fi-FI', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString))
}

export default function PipelineLog({ cardId, currentStatus, onStatusChange }: Props) {
  const [run, setRun] = useState<SerializedPipelineRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getPipelineStatus({ cardId }).then((result) => {
      if (cancelled) return
      if (!result.success) {
        setError(result.error)
      } else {
        // React auto-serializes Date objects from Server Actions — treat as SerializedPipelineRun
        setRun(result.data.run as unknown as SerializedPipelineRun)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [cardId, currentStatus])

  if (loading) {
    return (
      <div className="py-4 text-sm text-slate-500">Ladataan lokia...</div>
    )
  }

  if (error) {
    return (
      <div className="py-4 text-sm text-red-600">{error}</div>
    )
  }

  if (!run) {
    return (
      <div className="py-4 text-sm text-slate-500">Ei pipeline-ajoja.</div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Run header: stage + status */}
      <div className="flex items-center gap-2 flex-wrap">
        {run.stage && (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
            {STAGE_LABELS[run.stage] ?? run.stage}
          </span>
        )}
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
          {STATUS_LABELS[run.status] ?? run.status}
        </span>
      </div>

      {/* Run error */}
      {run.error && (
        <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <span className="font-medium">Virhe: </span>{run.error}
        </div>
      )}

      {/* Messages */}
      {run.messages.length === 0 ? (
        <p className="text-sm text-slate-500">Ei viesteja.</p>
      ) : (
        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto rounded border border-slate-200">
          {run.messages.map((msg, idx) => {
            const isUser = msg.role === 'user'
            return (
              <div
                key={msg.id}
                className={`px-3 py-2 ${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-semibold text-slate-600">
                    {isUser ? 'Jarjestelma' : 'Tekoaly'}
                  </span>
                  {msg.artifactType && (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-indigo-50 text-indigo-600 border border-indigo-100">
                      {msg.artifactType}
                    </span>
                  )}
                  <span className="text-xs text-slate-400 ml-auto">
                    {formatDate(msg.createdAt)}
                  </span>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono">
                  {msg.content}
                </pre>
              </div>
            )
          })}
        </div>
      )}

      {/* Pipeline control actions */}
      <PipelineActions
        cardId={cardId}
        status={currentStatus}
        onAction={onStatusChange}
      />
    </div>
  )
}
