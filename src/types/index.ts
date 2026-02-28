import type { Card, Column, Label, CardLabel, Priority } from '../generated/prisma/client'
import type { Prisma } from '../generated/prisma/client'

// Re-export model types
export type { Card, Column, Label, CardLabel, Priority }

// Card with its labels populated (through join table)
export type CardWithLabels = Prisma.CardGetPayload<{
  include: { labels: { include: { label: true } } }
}>

// Column with all its non-archived cards (and their labels), ordered by position
export type ColumnWithCards = Prisma.ColumnGetPayload<{
  include: {
    cards: {
      include: { labels: { include: { label: true } } }
      orderBy: { position: 'asc' }
    }
  }
}>

// Discriminated union for Server Action responses — serializable by React
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

// Input types for Server Actions
export type CreateTaskInput = {
  title: string
  columnId: string
  priority?: Priority
  description?: string
  dueDate?: string | null
  labelIds?: string[]
}

export type UpdateTaskInput = {
  id: string
  title?: string
  description?: string
  priority?: Priority
  dueDate?: string | null
  labelIds?: string[]
  archived?: boolean
}

export type MoveTaskInput = {
  id: string
  targetColumnId: string
  position: number
}

export type ReorderTasksInput = {
  id: string
  position: number
}[]

// Serialized types for RSC -> Client Component boundary
// Date fields converted from Date objects to ISO strings
export type SerializedCard = Omit<
  CardWithLabels,
  'dueDate' | 'createdAt' | 'updatedAt'
> & {
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export type SerializedColumn = Omit<ColumnWithCards, 'cards' | 'createdAt'> & {
  createdAt: string
  cards: SerializedCard[]
}
