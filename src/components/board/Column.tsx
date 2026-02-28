'use client'

import { useOptimistic } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import type { SerializedCard, SerializedColumn } from '@/types'
import Card from './Card'
import { AddCardForm } from './AddCardForm'

interface Props {
  column: SerializedColumn
  onCardClick: (card: SerializedCard) => void
}

export default function Column({ column, onCardClick }: Props) {
  const [optimisticCards, addOptimisticCard] = useOptimistic(
    column.cards,
    (state: SerializedCard[], newCard: SerializedCard) => [...state, newCard]
  )

  const { setNodeRef } = useDroppable({ id: column.id })
  const cardIds = optimisticCards.map(c => c.id)
  const lastPosition = column.cards.at(-1)?.position ?? 0

  return (
    <div className="flex flex-col w-[280px] shrink-0 bg-slate-200 rounded-xl">
      <div className="px-3 py-2.5 font-semibold text-sm text-slate-700 border-b border-slate-300">
        {column.name}
        <span className="ml-2 text-xs font-normal text-slate-500">
          {optimisticCards.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-2 flex flex-col gap-2"
      >
        <SortableContext items={cardIds} id={column.id} strategy={verticalListSortingStrategy}>
          {optimisticCards.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">
              Ei kortteja
            </p>
          ) : (
            optimisticCards.map((card) => (
              <Card
                key={card.id}
                card={card}
                onClick={!card.id.startsWith('optimistic-') ? () => onCardClick(card) : undefined}
              />
            ))
          )}
        </SortableContext>
      </div>
      <AddCardForm
        columnId={column.id}
        lastPosition={lastPosition}
        onOptimisticAdd={addOptimisticCard}
        isIdeaColumn={column.name === 'Idea'}
      />
    </div>
  )
}
