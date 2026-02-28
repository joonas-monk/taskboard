import { getBoard, getLabels } from '@/actions/tasks'
import BoardLoader from '@/components/board/BoardLoader'
import type { ColumnWithCards, SerializedColumn } from '@/types'

function serializeColumn(col: ColumnWithCards): SerializedColumn {
  return {
    ...col,
    createdAt: col.createdAt.toISOString(),
    cards: col.cards.map((card) => ({
      ...card,
      dueDate: card.dueDate ? card.dueDate.toISOString() : null,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
    })),
  }
}

export default async function HomePage() {
  const [columns, labels] = await Promise.all([getBoard(), getLabels()])
  const serialized = columns.map(serializeColumn)

  return (
    <main className="h-screen overflow-hidden">
      <BoardLoader columns={serialized} labels={labels} />
    </main>
  )
}
