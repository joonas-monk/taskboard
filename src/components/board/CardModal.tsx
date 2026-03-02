'use client'

import { useRef, useEffect, useActionState, useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTask, deleteTask } from '@/actions/tasks'
import type { SerializedCard, ActionResult, CardWithLabels } from '@/types'
import PipelineView from './PipelineView'

type Tab = 'kortti' | 'pipeline'

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
  const [activeTab, setActiveTab] = useState<Tab>('kortti')
  const router = useRouter()

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

  // Reset delete confirmation state and tab when card changes
  // Auto-open Pipeline tab if card has pipeline activity
  useEffect(() => {
    setConfirmDelete(false)
    setDeleteError(null)
    setActiveTab(card && card.pipelineStatus !== 'IDLE' ? 'pipeline' : 'kortti')
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
      className="rounded-2xl p-0 shadow-2xl backdrop:bg-black/30 backdrop:backdrop-blur-sm max-w-2xl w-full border-0"
    >
      {card && (
        <div className="p-6" key={card.id}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[17px] font-semibold text-gray-900 tracking-tight">{card.title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all duration-200"
              aria-label="Sulje"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Apple-style segmented control — always show if card has pipeline activity */}
          {card.pipelineStatus !== 'IDLE' && (
            <div className="flex p-0.5 bg-gray-100 rounded-lg mb-5">
              <button
                type="button"
                onClick={() => setActiveTab('kortti')}
                className={`flex-1 px-4 py-1.5 rounded-md text-[13px] font-semibold transition-all duration-200 ${
                  activeTab === 'kortti'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Kortti
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pipeline')}
                className={`flex-1 px-4 py-1.5 rounded-md text-[13px] font-semibold transition-all duration-200 ${
                  activeTab === 'pipeline'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Pipeline
              </button>
            </div>
          )}

          {/* Kortti tab: existing edit form and delete section */}
          {(card.pipelineStatus === 'IDLE' || activeTab === 'kortti') && (
            <>
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
                    className="bg-[#007AFF] hover:bg-[#0066DD] active:scale-[0.98] text-white px-5 py-2.5 rounded-full text-[14px] font-semibold disabled:opacity-50 transition-all duration-200 shadow-sm"
                  >
                    {isPending ? 'Tallennetaan...' : 'Tallenna'}
                  </button>
                  {updateState && !updateState.success && (
                    <p className="text-[#FF3B30] text-[13px]">{updateState.error}</p>
                  )}
                </div>
              </form>

              <div className="border-t border-gray-100 mt-6 pt-4">
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="text-[#FF3B30] hover:text-[#E0342B] text-[13px] font-medium transition-colors"
                  >
                    Poista kortti
                  </button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-[14px] text-gray-600">
                      Haluatko varmasti poistaa taman kortin?
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleteIsPending}
                        className="bg-[#FF3B30] hover:bg-[#E0342B] active:scale-[0.98] text-white px-5 py-2 rounded-full text-[13px] font-semibold disabled:opacity-50 transition-all duration-200"
                      >
                        {deleteIsPending ? 'Poistetaan...' : 'Vahvista poisto'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDelete(false)
                          setDeleteError(null)
                        }}
                        className="text-gray-500 hover:text-gray-700 px-4 py-2 rounded-full text-[13px] font-medium hover:bg-gray-100 transition-all duration-200"
                      >
                        Peruuta
                      </button>
                    </div>
                    {deleteError && (
                      <div className="rounded-xl bg-[#FF3B30]/5 border border-[#FF3B30]/10 px-4 py-2.5 text-[13px] text-[#FF3B30]">{deleteError}</div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Pipeline tab: Apple-style pipeline view */}
          {card.pipelineStatus !== 'IDLE' && activeTab === 'pipeline' && (
            <PipelineView
              cardId={card.id}
              currentStatus={card.pipelineStatus}
              onStatusChange={() => router.refresh()}
            />
          )}
        </div>
      )}
    </dialog>
  )
}
