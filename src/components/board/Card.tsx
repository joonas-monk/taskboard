'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { SerializedCard } from '@/types'
import PriorityBadge from './PriorityBadge'
import DateDisplay from './DateDisplay'
import LabelChip from './LabelChip'
import PipelineIndicator from './PipelineIndicator'

interface Props {
  card: SerializedCard
  onClick?: () => void
}

export default function Card({ card, onClick }: Props) {
  const isOptimistic = card.id.startsWith('optimistic-')
  const isPipelineActive = ['QUEUED', 'PLANNING', 'EXECUTING', 'TESTING', 'AWAITING_APPROVAL', 'AWAITING_EXEC_REVIEW', 'TEST_FAILED'].includes(card.pipelineStatus)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, disabled: isOptimistic })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : isOptimistic ? 0.6 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex flex-col gap-2 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      } ${isDragging ? 'shadow-lg ring-2 ring-blue-300' : ''} ${
        isPipelineActive ? 'shadow-[0_0_12px_rgba(0,122,255,0.15)] border-[#007AFF]/20' : ''
      }`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick() } : undefined}
    >
      <p className="text-sm font-medium text-slate-800 leading-snug">
        {card.title}
      </p>
      <PipelineIndicator status={card.pipelineStatus} />
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
