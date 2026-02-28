'use client'

import type { SerializedColumn } from '@/types'
import Card from './Card'

export default function Column({ column }: { column: SerializedColumn }) {
  return (
    <div className="flex flex-col w-[280px] shrink-0 bg-slate-200 rounded-xl">
      <div className="px-3 py-2.5 font-semibold text-sm text-slate-700 border-b border-slate-300">
        {column.name}
        <span className="ml-2 text-xs font-normal text-slate-500">
          {column.cards.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {column.cards.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">
            Ei kortteja
          </p>
        ) : (
          column.cards.map((card) => <Card key={card.id} card={card} />)
        )}
      </div>
    </div>
  )
}
