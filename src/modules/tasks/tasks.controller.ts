import type { Request, Response } from 'express';
import { currentUser } from '../../middlewares/auth.js';
import type {
  CreateTaskInput,
  ListTasksQuery,
  TaskIdParams,
  UpdateTaskInput,
} from './tasks.schemas.js';
import type { TasksService } from './tasks.service.js';

type TaskRequest = Request<TaskIdParams>;

export function createTasksController(service: TasksService) {
  return {
    list: async (req: Request, res: Response): Promise<void> => {
      const result = await service.list(
        currentUser(req).id,
        req.query as unknown as ListTasksQuery,
      );
      res.json(result);
    },

    getById: async (req: TaskRequest, res: Response): Promise<void> => {
      const task = await service.getById(currentUser(req).id, req.params.id);
      res.json(task);
    },

    create: async (req: Request, res: Response): Promise<void> => {
      const task = await service.create(currentUser(req).id, req.body as CreateTaskInput);
      res.status(201).json(task);
    },

    update: async (req: TaskRequest, res: Response): Promise<void> => {
      const task = await service.update(
        currentUser(req).id,
        req.params.id,
        req.body as UpdateTaskInput,
      );
      res.json(task);
    },

    remove: async (req: TaskRequest, res: Response): Promise<void> => {
      await service.remove(currentUser(req).id, req.params.id);
      res.status(204).end();
    },
  };
}
