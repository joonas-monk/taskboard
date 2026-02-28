'use client'

import dynamic from 'next/dynamic'
import type { SerializedColumn } from '@/types'

const Board = dynamic(() => import('@/components/board/Board'), { ssr: false })

export default function BoardLoader({ columns }: { columns: SerializedColumn[] }) {
  return <Board columns={columns} />
}
