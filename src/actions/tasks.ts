'use server'

import { prisma } from '@/lib/prisma'
import type {
  ActionResult,
  CardWithLabels,
  ColumnWithCards,
  CreateTaskInput,
  UpdateTaskInput,
  MoveTaskInput,
  ReorderTasksInput,
} from '@/types'
import {
  createTaskSchema,
  updateTaskSchema,
  moveTaskSchema,
  reorderTasksSchema,
} from './schemas'

function formatZodError(error: { issues: Array<{ message: string }> }): string {
  return error.issues.map((i) => i.message).join(', ')
}

export async function createTask(
  input: CreateTaskInput
): Promise<ActionResult<CardWithLabels>> {
  const parsed = createTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) }
  }
  // STUB: Phase 3 implements the actual Prisma create
  return { success: false, error: 'Ei toteutettu' }
}

export async function updateTask(
  input: UpdateTaskInput
): Promise<ActionResult<CardWithLabels>> {
  const parsed = updateTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) }
  }
  // STUB: Phase 3 implements
  return { success: false, error: 'Ei toteutettu' }
}

export async function moveTask(
  input: MoveTaskInput
): Promise<ActionResult<CardWithLabels>> {
  const parsed = moveTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) }
  }
  // STUB: Phase 4 implements (drag & drop)
  return { success: false, error: 'Ei toteutettu' }
}

export async function deleteTask(
  id: string
): Promise<ActionResult<void>> {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return { success: false, error: 'Tunniste vaaditaan' }
  }
  // STUB: Phase 3 implements
  return { success: false, error: 'Ei toteutettu' }
}

export async function reorderTasks(
  updates: ReorderTasksInput
): Promise<ActionResult<void>> {
  const parsed = reorderTasksSchema.safeParse(updates)
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) }
  }
  // STUB: Phase 4 implements (drag & drop reorder within column)
  return { success: false, error: 'Ei toteutettu' }
}

// Query function (not a Server Action -- no mutation)
// Fully implemented because Phase 2 needs it immediately
export async function getBoard(): Promise<ColumnWithCards[]> {
  const columns = await prisma.column.findMany({
    orderBy: { order: 'asc' },
    include: {
      cards: {
        where: { archived: false },
        orderBy: { position: 'asc' },
        include: {
          labels: {
            include: { label: true },
          },
        },
      },
    },
  })
  return columns as ColumnWithCards[]
}
