'use client'

import { useState } from 'react'
import type { SerializedCard, SerializedColumn } from '@/types'
import Column from './Column'
import { CardModal } from './CardModal'

interface Props {
  columns: SerializedColumn[]
  labels: { id: string; name: string; color: string }[]
}

export default function Board({ columns, labels }: Props) {
  const [selectedCard, setSelectedCard] = useState<SerializedCard | null>(null)

  return (
    <>
      <div className="flex h-screen overflow-x-auto overflow-y-hidden bg-slate-100 p-4 gap-3">
        {columns.map((col) => (
          <Column
            key={col.id}
            column={col}
            onCardClick={(card) => setSelectedCard(card)}
          />
        ))}
      </div>
      <CardModal
        card={selectedCard}
        labels={labels}
        onClose={() => setSelectedCard(null)}
      />
    </>
  )
}
