'use client'

import type { Priority } from '@/types'

const PRIORITY_CONFIG: Record<Priority, { label: string; className: string }> = {
  CRITICAL: { label: 'Kriittinen', className: 'bg-red-100 text-red-700' },
  HIGH: { label: 'Korkea', className: 'bg-orange-100 text-orange-700' },
  MEDIUM: { label: 'Keskitaso', className: 'bg-blue-100 text-blue-700' },
  LOW: { label: 'Matala', className: 'bg-gray-100 text-gray-600' },
}

export default function PriorityBadge({ priority }: { priority: Priority }) {
  const config = PRIORITY_CONFIG[priority]
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  )
}
