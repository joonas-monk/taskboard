'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { positionAfterLast } from '@/lib/positions'
import type {
  ActionResult,
  CardWithLabels,
  ColumnWithCards,
  CreateTaskInput,
  UpdateTaskInput,
  MoveTaskInput,
  ReorderTasksInput,
} from '@/types'
import type { Label } from '@/types'
import {
  createTaskSchema,
  updateTaskSchema,
  moveTaskSchema,
  reorderTasksSchema,
} from './schemas'
import { startPipeline } from './ai'

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

  try {
    const last = await prisma.card.findFirst({
      where: { columnId: parsed.data.columnId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    const position = positionAfterLast(last?.position ?? 0)

    const card = await prisma.card.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description ?? '',
        priority: parsed.data.priority ?? 'MEDIUM',
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        position,
        columnId: parsed.data.columnId,
        labels: parsed.data.labelIds?.length
          ? {
              create: parsed.data.labelIds.map((labelId) => ({
                label: { connect: { id: labelId } },
              })),
            }
          : undefined,
      },
      include: { labels: { include: { label: true } } },
    })

    // AI-01: Auto-start pipeline for cards created in the Idea column.
    // Detect Idea column by querying its name (first column from seed data).
    const column = await prisma.column.findUnique({
      where: { id: parsed.data.columnId },
      select: { name: true },
    })
    if (column?.name === 'Idea') {
      // Fire-and-forget — startPipeline spawns a detached worker.
      // Errors are recorded in PipelineRun, not propagated to card creation.
      startPipeline({ cardId: card.id }).catch(() => {
        // Silently ignore — pipeline failure is tracked via pipelineStatus = FAILED
      })
    }

    revalidatePath('/')
    return { success: true, data: card }
  } catch {
    return { success: false, error: 'Kortin luonti epaonnistui' }
  }
}

export async function updateTask(
  input: UpdateTaskInput
): Promise<ActionResult<CardWithLabels>> {
  const parsed = updateTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) }
  }

  try {
    const { id, labelIds, dueDate, ...rest } = parsed.data

    const card = await prisma.card.update({
      where: { id },
      data: {
        ...rest,
        dueDate: dueDate === undefined ? undefined : dueDate ? new Date(dueDate) : null,
        ...(labelIds !== undefined && {
          labels: {
            deleteMany: {},
            create: labelIds.map((labelId) => ({
              label: { connect: { id: labelId } },
            })),
          },
        }),
      },
      include: { labels: { include: { label: true } } },
    })

    revalidatePath('/')
    return { success: true, data: card }
  } catch {
    return { success: false, error: 'Kortin paivitys epaonnistui' }
  }
}

export async function moveTask(
  input: MoveTaskInput
): Promise<ActionResult<CardWithLabels>> {
  const parsed = moveTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) }
  }

  try {
    const card = await prisma.card.update({
      where: { id: parsed.data.id },
      data: {
        columnId: parsed.data.targetColumnId,
        position: parsed.data.position,
      },
      include: { labels: { include: { label: true } } },
    })
    revalidatePath('/')
    return { success: true, data: card }
  } catch {
    return { success: false, error: 'Kortin siirto epäonnistui' }
  }
}

export async function deleteTask(
  id: string
): Promise<ActionResult<void>> {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return { success: false, error: 'Tunniste vaaditaan' }
  }

  try {
    await prisma.card.delete({ where: { id } })
    revalidatePath('/')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Kortin poisto epaonnistui' }
  }
}

export async function reorderTasks(
  updates: ReorderTasksInput
): Promise<ActionResult<void>> {
  const parsed = reorderTasksSchema.safeParse(updates)
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) }
  }

  try {
    await prisma.$transaction(
      parsed.data.map(({ id, position }) =>
        prisma.card.update({ where: { id }, data: { position } })
      )
    )
    revalidatePath('/')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Järjestyksen tallennus epäonnistui' }
  }
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

// Query function for fetching all labels (not a mutation)
export async function getLabels(): Promise<Label[]> {
  return prisma.label.findMany({ orderBy: { name: 'asc' } })
}
