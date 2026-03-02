import { z } from 'zod'

export const startPipelineSchema = z.object({
  cardId: z.string().min(1, 'Kortin tunniste vaaditaan'),
})

export const getPipelineStatusSchema = z.object({
  cardId: z.string().min(1, 'Kortin tunniste vaaditaan'),
})

export const pausePipelineSchema = z.object({
  cardId: z.string().min(1, 'Kortin tunniste vaaditaan'),
})

export const approvePlanSchema = z.object({
  cardId: z.string().min(1, 'Kortin tunniste vaaditaan'),
  editedPlan: z.string().optional(),
})
