'use client'

import { useTransition, useState } from 'react'
import { startPipeline, pausePipeline } from '@/actions/ai'

const PAUSEABLE = new Set(['PLANNING', 'EXECUTING', 'TESTING'])
const RETRIABLE = new Set(['FAILED', 'PAUSED'])
const STARTABLE = new Set(['IDLE'])

interface Props {
  cardId: string
  status: string
  onAction: () => void
}

export default function PipelineActions({ cardId, status, onAction }: Props) {
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)

  function handlePause() {
    setActionError(null)
    startTransition(async () => {
      const result = await pausePipeline({ cardId })
      if (!result.success) {
        setActionError(result.error)
      } else {
        onAction()
      }
    })
  }

  function handleStart() {
    setActionError(null)
    startTransition(async () => {
      const result = await startPipeline({ cardId })
      if (!result.success) {
        setActionError(result.error)
      } else {
        onAction()
      }
    })
  }

  return (
    <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-200">
      <div className="flex gap-2 flex-wrap">
        {PAUSEABLE.has(status) && (
          <button
            type="button"
            onClick={handlePause}
            disabled={isPending}
            className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Odota...' : 'Pysayta'}
          </button>
        )}
        {RETRIABLE.has(status) && (
          <button
            type="button"
            onClick={handleStart}
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Kaynnistetaan...' : 'Kaynnista uudelleen'}
          </button>
        )}
        {STARTABLE.has(status) && (
          <button
            type="button"
            onClick={handleStart}
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Kaynnistetaan...' : 'Kaynnista pipeline'}
          </button>
        )}
      </div>
      {actionError && (
        <p className="text-red-600 text-sm">{actionError}</p>
      )}
    </div>
  )
}
