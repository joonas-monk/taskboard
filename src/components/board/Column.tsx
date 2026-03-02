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
    <div className="flex flex-col w-[280px] shrink-0 bg-gray-100/80 backdrop-blur-sm rounded-2xl">
      <div className="px-4 py-3 font-semibold text-[13px] text-gray-700 tracking-wide uppercase">
        {column.name}
        <span className="ml-2 text-[12px] font-normal text-gray-400 normal-case tracking-normal">
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
