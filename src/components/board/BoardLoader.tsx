'use client'

import dynamic from 'next/dynamic'
import type { SerializedColumn } from '@/types'

const Board = dynamic(() => import('@/components/board/Board'), { ssr: false })

interface Props {
  columns: SerializedColumn[]
  labels: { id: string; name: string; color: string }[]
}

export default function BoardLoader({ columns, labels }: Props) {
  return <Board columns={columns} labels={labels} />
}
