'use client'

import { useState, useTransition } from 'react'
import { createTask } from '@/actions/tasks'
import type { SerializedCard } from '@/types'

interface Props {
  columnId: string
  lastPosition: number
  onOptimisticAdd: (card: SerializedCard) => void
}

export function AddCardForm({ columnId, lastPosition, onOptimisticAdd }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    const optimisticCard: SerializedCard = {
      id: 'optimistic-' + Date.now(),
      title: title.trim(),
      description: '',
      priority: 'MEDIUM',
      dueDate: null,
      archived: false,
      position: lastPosition + 1000,
      columnId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      labels: [],
    }

    startTransition(async () => {
      onOptimisticAdd(optimisticCard)
      setTitle('')
      setOpen(false)
      setError(null)
      const result = await createTask({ title: optimisticCard.title, columnId })
      if (!result.success) {
        setError(result.error)
      }
    })
  }

  if (!open) {
    return (
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full text-slate-500 hover:text-slate-700 hover:bg-slate-300 rounded py-1.5 text-sm transition-colors"
          aria-label="Lisaa kortti"
        >
          + Lisaa kortti
        </button>
        {error && (
          <p className="text-red-600 text-xs mt-1 px-1">{error}</p>
        )}
      </div>
    )
  }

  return (
    <div className="px-2 pb-2">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="text"
          placeholder="Uusi kortti..."
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isPending}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Lisaa
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setTitle('')
            }}
            className="text-slate-600 px-3 py-1 rounded text-sm hover:bg-slate-300 transition-colors"
          >
            Peruuta
          </button>
        </div>
        {error && (
          <p className="text-red-600 text-xs">{error}</p>
        )}
      </form>
    </div>
  )
}
