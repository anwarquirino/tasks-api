import { Router } from 'express';
import type { Database } from '../../db/index.js';
import { validate } from '../../middlewares/validate.js';
import { createTasksController } from './tasks.controller.js';
import {
  createTaskSchema,
  listTasksQuerySchema,
  taskIdParamsSchema,
  updateTaskSchema,
} from './tasks.schemas.js';
import { createTasksService } from './tasks.service.js';

export function createTasksRouter(db: Database): Router {
  const controller = createTasksController(createTasksService(db));
  const router = Router();

  router.get('/', validate({ query: listTasksQuerySchema }), controller.list);
  router.post('/', validate({ body: createTaskSchema }), controller.create);
  router.get('/:id', validate({ params: taskIdParamsSchema }), controller.getById);
  router.patch(
    '/:id',
    validate({ params: taskIdParamsSchema, body: updateTaskSchema }),
    controller.update,
  );
  router.delete('/:id', validate({ params: taskIdParamsSchema }), controller.remove);

  return router;
}
