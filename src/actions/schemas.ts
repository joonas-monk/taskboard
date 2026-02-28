import { z } from 'zod'

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Otsikko vaaditaan').max(200, 'Otsikko liian pitka'),
  columnId: z.string().min(1),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  description: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
})

export const updateTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  dueDate: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
  archived: z.boolean().optional(),
})

export const moveTaskSchema = z.object({
  id: z.string().min(1),
  targetColumnId: z.string().min(1),
  position: z.number(),
})

export const reorderTasksSchema = z.array(
  z.object({
    id: z.string().min(1),
    position: z.number(),
  })
)
