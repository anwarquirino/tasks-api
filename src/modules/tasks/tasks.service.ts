import { and, asc, count, desc, eq, type SQL } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import { tasks, type Task } from '../../db/schema.js';
import { HttpError } from '../../lib/http-error.js';
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from './tasks.schemas.js';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TaskListResult {
  data: Task[];
  meta: PaginationMeta;
}

export interface TasksService {
  list(userId: string, query: ListTasksQuery): Promise<TaskListResult>;
  getById(userId: string, taskId: string): Promise<Task>;
  create(userId: string, input: CreateTaskInput): Promise<Task>;
  update(userId: string, taskId: string, input: UpdateTaskInput): Promise<Task>;
  remove(userId: string, taskId: string): Promise<void>;
}

const SORT_COLUMNS = {
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
  dueDate: tasks.dueDate,
  priority: tasks.priority,
  title: tasks.title,
} as const;

/** Every query is scoped by user, so another user's task is simply "not found". */
function ownedBy(userId: string, taskId: string): SQL | undefined {
  return and(eq(tasks.id, taskId), eq(tasks.userId, userId));
}

function notFound(): HttpError {
  return HttpError.notFound('Tarefa não encontrada', 'TASK_NOT_FOUND');
}

export function createTasksService(db: Database): TasksService {
  return {
    async list(userId, query) {
      const filters: SQL[] = [eq(tasks.userId, userId)];
      if (query.status) filters.push(eq(tasks.status, query.status));
      if (query.priority) filters.push(eq(tasks.priority, query.priority));
      const where = and(...filters);

      const sortColumn = SORT_COLUMNS[query.sortBy];
      const primaryOrder = query.order === 'asc' ? asc(sortColumn) : desc(sortColumn);
      const offset = (query.page - 1) * query.limit;

      const [data, totals] = await Promise.all([
        db
          .select()
          .from(tasks)
          .where(where)
          // Secondary order by id keeps pagination stable when values tie.
          .orderBy(primaryOrder, asc(tasks.id))
          .limit(query.limit)
          .offset(offset),
        db.select({ total: count() }).from(tasks).where(where),
      ]);

      const total = totals[0]?.total ?? 0;

      return {
        data,
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    },

    async getById(userId, taskId) {
      const task = await db.query.tasks.findFirst({ where: ownedBy(userId, taskId) });
      if (!task) throw notFound();
      return task;
    },

    async create(userId, input) {
      const [task] = await db
        .insert(tasks)
        .values({ ...input, userId })
        .returning();
      if (!task) {
        throw new Error('O banco não retornou a tarefa criada');
      }
      return task;
    },

    async update(userId, taskId, input) {
      const changes = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      ) as UpdateTaskInput;

      if (Object.keys(changes).length === 0) {
        throw HttpError.badRequest(
          'Informe pelo menos um campo para atualizar',
          undefined,
          'VALIDATION_ERROR',
        );
      }

      const [task] = await db.update(tasks).set(changes).where(ownedBy(userId, taskId)).returning();
      if (!task) throw notFound();
      return task;
    },

    async remove(userId, taskId) {
      const deleted = await db
        .delete(tasks)
        .where(ownedBy(userId, taskId))
        .returning({ id: tasks.id });
      if (deleted.length === 0) throw notFound();
    },
  };
}
