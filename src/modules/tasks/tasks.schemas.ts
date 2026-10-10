import { z } from 'zod';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../db/schema.js';

const titleSchema = z
  .string()
  .trim()
  .min(1, 'O título é obrigatório')
  .max(200, 'O título deve ter no máximo 200 caracteres');

const descriptionSchema = z
  .string()
  .trim()
  .max(2000, 'A descrição deve ter no máximo 2000 caracteres')
  .nullable();

const dueDateSchema = z.iso
  .datetime({
    offset: true,
    error: 'dueDate deve ser uma data ISO 8601 (ex.: 2026-12-31T23:59:00Z)',
  })
  .transform((value) => new Date(value))
  .nullable();

export const taskStatusSchema = z.enum(TASK_STATUSES, {
  error: `status deve ser um de: ${TASK_STATUSES.join(', ')}`,
});

export const taskPrioritySchema = z.enum(TASK_PRIORITIES, {
  error: `priority deve ser um de: ${TASK_PRIORITIES.join(', ')}`,
});

export const createTaskSchema = z.object({
  title: titleSchema,
  description: descriptionSchema.optional(),
  status: taskStatusSchema.default('pending'),
  priority: taskPrioritySchema.default('medium'),
  dueDate: dueDateSchema.optional(),
});

export const updateTaskSchema = z.object({
  title: titleSchema.optional(),
  description: descriptionSchema.optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  dueDate: dueDateSchema.optional(),
});

export const TASK_SORT_FIELDS = ['createdAt', 'updatedAt', 'dueDate', 'priority', 'title'] as const;

export const listTasksQuerySchema = z.object({
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z
    .enum(TASK_SORT_FIELDS, { error: `sortBy deve ser um de: ${TASK_SORT_FIELDS.join(', ')}` })
    .default('createdAt'),
  order: z.enum(['asc', 'desc'], { error: 'order deve ser asc ou desc' }).default('desc'),
});

export const taskIdParamsSchema = z.object({
  id: z.uuid('O id da tarefa deve ser um UUID válido'),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type TaskIdParams = z.infer<typeof taskIdParamsSchema>;
