import type { Card, Column, Label, CardLabel, Priority, CardType, PipelineStatus, PipelineRun, PipelineMessage } from '../generated/prisma/client'
import type { Prisma } from '../generated/prisma/client'

// Re-export model types
export type { Card, Column, Label, CardLabel, Priority, CardType, PipelineStatus, PipelineRun, PipelineMessage }

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
  cardType?: CardType
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

// Pipeline Server Action input types
export type StartPipelineInput = {
  cardId: string
}

// Pipeline status query result
export type PipelineStatusResult = {
  status: PipelineStatus
  run: (PipelineRun & { messages: PipelineMessage[] }) | null
}

// Serialized pipeline types for RSC -> Client boundary
export type SerializedPipelineMessage = Omit<PipelineMessage, 'createdAt'> & {
  createdAt: string
}

export type SerializedPipelineRun = Omit<PipelineRun, 'createdAt' | 'updatedAt' | 'messages'> & {
  createdAt: string
  updatedAt: string
  messages: SerializedPipelineMessage[]
}

// Serialized types for RSC -> Client Component boundary
// Date fields converted from Date objects to ISO strings
export type SerializedCard = Omit<
  CardWithLabels,
  'dueDate' | 'createdAt' | 'updatedAt'
> & {
  dueDate: string | null
  createdAt: string
  updatedAt: string
  // Pipeline fields are non-Date scalars — pass through unchanged
  // cardType: CardType and pipelineStatus: PipelineStatus are already included via Omit spread
}

export type SerializedColumn = Omit<ColumnWithCards, 'cards' | 'createdAt'> & {
  createdAt: string
  cards: SerializedCard[]
}
