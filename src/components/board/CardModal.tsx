'use client'

import { useRef, useEffect, useActionState, useTransition, useState } from 'react'
import { updateTask, deleteTask } from '@/actions/tasks'
import type { SerializedCard, ActionResult, CardWithLabels } from '@/types'

interface Props {
  card: SerializedCard | null
  labels: { id: string; name: string; color: string }[]
  onClose: () => void
}

export function CardModal({ card, labels, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteIsPending, startDeleteTransition] = useTransition()

  // Sync dialog open/close state with card prop
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (card) {
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }
  }, [card])

  // Reset delete confirmation state when card changes
  useEffect(() => {
    setConfirmDelete(false)
    setDeleteError(null)
  }, [card])

  // Close on backdrop click
  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      onClose()
    }
  }

  const [updateState, formAction, isPending] = useActionState(
    async (_prevState: ActionResult<CardWithLabels> | null, formData: FormData) => {
      if (!card) return null
      const title = formData.get('title') as string
      const description = formData.get('description') as string
      const priority = formData.get('priority') as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
      const dueDate = formData.get('dueDate') as string
      const labelIds = formData.getAll('labelIds') as string[]

      const result = await updateTask({
        id: card.id,
        title,
        description,
        priority,
        dueDate: dueDate || null,
        labelIds,
      })

      if (result.success) {
        onClose()
        return null
      }
      return result
    },
    null
  )

  function handleDelete() {
    if (!card) return
    startDeleteTransition(async () => {
      const result = await deleteTask(card.id)
      if (result.success) {
        onClose()
      } else {
        setDeleteError(result.error)
      }
    })
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={handleDialogClick}
      className="rounded-xl p-0 shadow-xl backdrop:bg-black/40 max-w-lg w-full"
    >
      {card && (
        <div className="p-6" key={card.id}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Muokkaa korttia</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-xl leading-none p-1"
              aria-label="Sulje"
            >
              &times;
            </button>
          </div>

          <form action={formAction} key={card.id} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={card.id} />

            <div className="flex flex-col gap-1">
              <label htmlFor="card-title" className="text-sm font-medium text-slate-700">
                Otsikko
              </label>
              <input
                id="card-title"
                type="text"
                name="title"
                defaultValue={card.title}
                required
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="card-description" className="text-sm font-medium text-slate-700">
                Kuvaus
              </label>
              <textarea
                id="card-description"
                name="description"
                defaultValue={card.description}
                rows={4}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm resize-y min-h-[100px] focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="card-priority" className="text-sm font-medium text-slate-700">
                Prioriteetti
              </label>
              <select
                id="card-priority"
                name="priority"
                defaultValue={card.priority}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="CRITICAL">Kriittinen</option>
                <option value="HIGH">Korkea</option>
                <option value="MEDIUM">Keskitaso</option>
                <option value="LOW">Matala</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="card-duedate" className="text-sm font-medium text-slate-700">
                Erapaiva
              </label>
              <input
                id="card-duedate"
                type="date"
                name="dueDate"
                defaultValue={card.dueDate ? card.dueDate.slice(0, 10) : ''}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-700">Tarrat</span>
              <div className="flex flex-col gap-2 mt-1">
                {labels.map((label) => (
                  <label key={label.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="labelIds"
                      value={label.id}
                      defaultChecked={card.labels.some((cl) => cl.label.id === label.id)}
                      className="rounded"
                    />
                    <span
                      className="w-3 h-3 rounded-full shrink-0 inline-block"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="text-sm text-slate-700">{label.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Tallennetaan...' : 'Tallenna'}
              </button>
              {updateState && !updateState.success && (
                <p className="text-red-600 text-sm">{updateState.error}</p>
              )}
            </div>
          </form>

          <div className="border-t border-slate-200 mt-6 pt-4">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-red-600 hover:text-red-700 text-sm transition-colors"
              >
                Poista kortti
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-slate-600">
                  Haluatko varmasti poistaa taman kortin?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleteIsPending}
                    className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {deleteIsPending ? 'Poistetaan...' : 'Vahvista poisto'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDelete(false)
                      setDeleteError(null)
                    }}
                    className="text-slate-600 px-3 py-1.5 rounded text-sm hover:bg-slate-200 transition-colors"
                  >
                    Peruuta
                  </button>
                </div>
                {deleteError && (
                  <p className="text-red-600 text-sm">{deleteError}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}
