'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  useSensors,
  useSensor,
  PointerSensor,
  KeyboardSensor,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable'
import type { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core'
import type { SerializedCard, SerializedColumn } from '@/types'
import { midpoint, positionAfterLast, needsRebalance, rebalancePositions } from '@/lib/positions'
import { moveTask, reorderTasks } from '@/actions/tasks'
import Column from './Column'
import Card from './Card'
import { CardModal } from './CardModal'

interface Props {
  columns: SerializedColumn[]
  labels: { id: string; name: string; color: string }[]
}

export default function Board({ columns: serverColumns, labels }: Props) {
  const router = useRouter()
  const [columns, setColumns] = useState(serverColumns)
  const [selectedCard, setSelectedCard] = useState<SerializedCard | null>(null)
  const [activeCard, setActiveCard] = useState<SerializedCard | null>(null)

  // Sync local state when server re-renders with new data (after revalidatePath)
  useEffect(() => {
    setColumns(serverColumns)
  }, [serverColumns])

  // Auto-refresh board while any card has active pipeline status
  useEffect(() => {
    const ACTIVE_STATUSES = new Set(['QUEUED', 'PLANNING', 'EXECUTING', 'TESTING'])
    const allCards = columns.flatMap(col => col.cards)
    if (!allCards.some(c => ACTIVE_STATUSES.has(c.pipelineStatus))) return

    const id = setInterval(() => {
      router.refresh()
    }, 5000)

    return () => clearInterval(id)
  }, [columns, router])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Find which column contains a given card ID
  const findColumnByCardId = useCallback((cardId: string): SerializedColumn | undefined => {
    return columns.find(col => col.cards.some(c => c.id === cardId))
  }, [columns])

  function handleDragStart(event: DragStartEvent) {
    const cardId = event.active.id as string
    const col = findColumnByCardId(cardId)
    const card = col?.cards.find(c => c.id === cardId)
    setActiveCard(card ?? null)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeCardId = active.id as string
    const overId = over.id as string

    // Determine container IDs
    const activeColId = active.data.current?.sortable?.containerId as string | undefined
    const overColId = (over.data.current?.sortable?.containerId as string | undefined) ?? overId

    // If no container info or same column, skip
    if (!activeColId || activeColId === overColId) return

    setColumns(prev => {
      const sourceCol = prev.find(c => c.id === activeColId)
      const destCol = prev.find(c => c.id === overColId)
      if (!sourceCol || !destCol) return prev

      const activeCardObj = sourceCol.cards.find(c => c.id === activeCardId)
      if (!activeCardObj) return prev

      // Already moved (can fire multiple times)
      if (destCol.cards.some(c => c.id === activeCardId)) return prev

      const overIndex = destCol.cards.findIndex(c => c.id === overId)
      const insertAt = overIndex >= 0 ? overIndex : destCol.cards.length

      return prev.map(col => {
        if (col.id === activeColId) {
          return { ...col, cards: col.cards.filter(c => c.id !== activeCardId) }
        }
        if (col.id === overColId) {
          const newCards = [...col.cards]
          newCards.splice(insertAt, 0, activeCardObj)
          return { ...col, cards: newCards }
        }
        return col
      })
    })
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveCard(null)

    if (!over) return

    const activeCardId = active.id as string
    const overId = over.id as string

    // Determine current container (after onDragOver may have moved it)
    const currentCol = columns.find(col => col.cards.some(c => c.id === activeCardId))
    if (!currentCol) return

    const sourceColId = active.data.current?.sortable?.containerId as string | undefined
    const overColId = (over.data.current?.sortable?.containerId as string | undefined) ?? overId

    const isSameColumn = sourceColId === overColId || sourceColId === currentCol.id

    if (isSameColumn && sourceColId) {
      // Within-column reorder
      const col = columns.find(c => c.id === sourceColId)
      if (!col) return

      const ids = col.cards.map(c => c.id)
      const oldIdx = ids.indexOf(activeCardId)
      const newIdx = ids.indexOf(overId)
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return

      const reordered = arrayMove(col.cards, oldIdx, newIdx)

      // Update local state synchronously (prevents snap-back flicker)
      setColumns(prev =>
        prev.map(c => c.id === sourceColId ? { ...c, cards: reordered } : c)
      )

      // Compute float position for moved card
      const prev_ = reordered[newIdx - 1]?.position ?? 0
      const next_ = reordered[newIdx + 1]?.position
      let newPosition: number

      if (next_ === undefined) {
        newPosition = positionAfterLast(prev_)
      } else {
        newPosition = midpoint(prev_, next_)
      }

      // Check if rebalance needed
      const gap = next_ !== undefined ? next_ - prev_ : Infinity
      if (needsRebalance(gap)) {
        // Rebalance all cards in column
        const positions = rebalancePositions(reordered.length)
        const updates = reordered.map((card, i) => ({
          id: card.id,
          position: positions[i],
        }))
        await reorderTasks(updates)
      } else {
        // Update only the moved card
        await reorderTasks([{ id: activeCardId, position: newPosition }])
      }
    } else {
      // Cross-column move (card already moved in onDragOver state)
      // Find card's current position in destination column
      const destCol = columns.find(col => col.cards.some(c => c.id === activeCardId))
      if (!destCol) return

      const cardIndex = destCol.cards.findIndex(c => c.id === activeCardId)
      const prev_ = destCol.cards[cardIndex - 1]?.position ?? 0
      const next_ = destCol.cards[cardIndex + 1]?.position

      let newPosition: number
      if (next_ === undefined) {
        newPosition = positionAfterLast(prev_)
      } else {
        newPosition = midpoint(prev_, next_)
      }

      await moveTask({
        id: activeCardId,
        targetColumnId: destCol.id,
        position: newPosition,
      })
    }
  }

  function handleDragCancel() {
    setActiveCard(null)
    setColumns(serverColumns) // revert to server state
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex h-screen overflow-x-auto overflow-y-hidden bg-slate-100 p-4 gap-3">
        {columns.map((col) => (
          <Column
            key={col.id}
            column={col}
            onCardClick={(card) => setSelectedCard(card)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeCard ? <Card card={activeCard} /> : null}
      </DragOverlay>
      <CardModal
        card={selectedCard}
        labels={labels}
        onClose={() => setSelectedCard(null)}
      />
    </DndContext>
  )
}
