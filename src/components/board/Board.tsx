'use client'

import type { SerializedColumn } from '@/types'
import Column from './Column'

export default function Board({ columns }: { columns: SerializedColumn[] }) {
  return (
    <div className="flex h-screen overflow-x-auto overflow-y-hidden bg-slate-100 p-4 gap-3">
      {columns.map((col) => (
        <Column key={col.id} column={col} />
      ))}
    </div>
  )
}
