'use client'

import type { SerializedCard } from '@/types'
import PriorityBadge from './PriorityBadge'
import DateDisplay from './DateDisplay'
import LabelChip from './LabelChip'

interface Props {
  card: SerializedCard
  onClick?: () => void
}

export default function Card({ card, onClick }: Props) {
  const isOptimistic = card.id.startsWith('optimistic-')

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-slate-200 p-3 flex flex-col gap-2 ${
        onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
      } ${isOptimistic ? 'opacity-60' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick() } : undefined}
    >
      <p className="text-sm font-medium text-slate-800 leading-snug">
        {card.title}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <PriorityBadge priority={card.priority} />
        {card.dueDate && <DateDisplay dueDate={card.dueDate} />}
      </div>
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.labels.map(({ label }) => (
            <LabelChip key={label.id} name={label.name} color={label.color} />
          ))}
        </div>
      )}
    </div>
  )
}
