import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Task } from '../src/db/schema.js';
import type { TaskListResult } from '../src/modules/tasks/tasks.service.js';
import {
  bearer,
  createTask,
  createTestContext,
  registerUser,
  type TestContext,
  type TestUser,
} from './helpers.js';

interface ErrorBody {
  error: { code: string; message: string; details?: { path: string; message: string }[] };
}

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('tarefas', () => {
  let ctx: TestContext;
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    ctx = await createTestContext();
    alice = await registerUser(ctx.app);
    bob = await registerUser(ctx.app);
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('autenticação obrigatória', () => {
    it('responde 401 sem token em qualquer rota de tarefas', async () => {
      await request(ctx.app).get('/tasks').expect(401);
      await request(ctx.app).post('/tasks').send({ title: 'x' }).expect(401);
      await request(ctx.app).get(`/tasks/${UNKNOWN_ID}`).expect(401);
      await request(ctx.app).patch(`/tasks/${UNKNOWN_ID}`).send({ title: 'x' }).expect(401);
      await request(ctx.app).delete(`/tasks/${UNKNOWN_ID}`).expect(401);
    });
  });

  describe('POST /tasks', () => {
    it('cria a tarefa com valores padrão e título normalizado', async () => {
      const task = await createTask(ctx.app, alice.token, { title: '  Comprar pão  ' });

      expect(task).toMatchObject({
        title: 'Comprar pão',
        description: null,
        status: 'pending',
        priority: 'medium',
        dueDate: null,
        userId: alice.id,
      });
      expect(task.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(task.createdAt).toBe(task.updatedAt);
    });

    it('aceita todos os campos e converte o prazo para UTC', async () => {
      const task = await createTask(ctx.app, alice.token, {
        title: 'Entregar relatório',
        description: 'Versão final',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2026-12-31T23:59:00-03:00',
      });

      expect(task).toMatchObject({
        title: 'Entregar relatório',
        description: 'Versão final',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2027-01-01T02:59:00.000Z',
      });
    });

    it('rejeita dados inválidos com 400 detalhando cada campo', async () => {
      const res = await request(ctx.app)
        .post('/tasks')
        .set(bearer(alice.token))
        .send({ title: '', status: 'feito', priority: 'urgente', dueDate: 'amanhã' })
        .expect(400);

      const { error } = res.body as ErrorBody;
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details?.map((d) => d.path).sort()).toEqual([
        'dueDate',
        'priority',
        'status',
        'title',
      ]);
    });
  });

  describe('GET /tasks/:id', () => {
    it('devolve a tarefa do próprio usuário', async () => {
      const created = await createTask(ctx.app, alice.token);

      const res = await request(ctx.app)
        .get(`/tasks/${created.id}`)
        .set(bearer(alice.token))
        .expect(200);

      expect(res.body).toEqual(created);
    });

    it('responde 404 para id inexistente', async () => {
      const res = await request(ctx.app)
        .get(`/tasks/${UNKNOWN_ID}`)
        .set(bearer(alice.token))
        .expect(404);

      expect((res.body as ErrorBody).error.code).toBe('TASK_NOT_FOUND');
    });

    it('responde 400 para id que não é UUID', async () => {
      const res = await request(ctx.app).get('/tasks/123').set(bearer(alice.token)).expect(400);

      expect((res.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /tasks/:id', () => {
    it('atualiza apenas os campos enviados e renova updatedAt', async () => {
      const created = await createTask(ctx.app, alice.token, {
        title: 'Original',
        description: 'Mantida',
        dueDate: '2026-11-01T12:00:00Z',
      });

      const res = await request(ctx.app)
        .patch(`/tasks/${created.id}`)
        .set(bearer(alice.token))
        .send({ status: 'done', priority: 'low', dueDate: null })
        .expect(200);

      const updated = res.body as Task;
      expect(updated).toMatchObject({
        id: created.id,
        title: 'Original',
        description: 'Mantida',
        status: 'done',
        priority: 'low',
        dueDate: null,
      });
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updatedAt).getTime(),
      );
    });

    it('rejeita corpo vazio com 400', async () => {
      const created = await createTask(ctx.app, alice.token);

      const res = await request(ctx.app)
        .patch(`/tasks/${created.id}`)
        .set(bearer(alice.token))
        .send({})
        .expect(400);

      expect((res.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    });

    it('rejeita valores inválidos com 400', async () => {
      const created = await createTask(ctx.app, alice.token);

      const res = await request(ctx.app)
        .patch(`/tasks/${created.id}`)
        .set(bearer(alice.token))
        .send({ status: 'cancelado' })
        .expect(400);

      expect((res.body as ErrorBody).error.details?.[0]?.path).toBe('status');
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('remove a tarefa e passa a responder 404', async () => {
      const created = await createTask(ctx.app, alice.token);

      await request(ctx.app).delete(`/tasks/${created.id}`).set(bearer(alice.token)).expect(204);
      await request(ctx.app).get(`/tasks/${created.id}`).set(bearer(alice.token)).expect(404);
      await request(ctx.app).delete(`/tasks/${created.id}`).set(bearer(alice.token)).expect(404);
    });
  });

  describe('isolamento entre usuários', () => {
    it('um usuário não vê, altera nem remove tarefas de outro', async () => {
      const task = await createTask(ctx.app, alice.token, { title: 'Só da Alice' });

      const get = await request(ctx.app)
        .get(`/tasks/${task.id}`)
        .set(bearer(bob.token))
        .expect(404);
      expect((get.body as ErrorBody).error.code).toBe('TASK_NOT_FOUND');

      await request(ctx.app)
        .patch(`/tasks/${task.id}`)
        .set(bearer(bob.token))
        .send({ title: 'Invadida' })
        .expect(404);

      await request(ctx.app).delete(`/tasks/${task.id}`).set(bearer(bob.token)).expect(404);

      const stillThere = await request(ctx.app)
        .get(`/tasks/${task.id}`)
        .set(bearer(alice.token))
        .expect(200);
      expect((stillThere.body as Task).title).toBe('Só da Alice');
    });

    it('a listagem só traz tarefas do próprio usuário', async () => {
      await createTask(ctx.app, bob.token, { title: 'Do Bob' });

      const res = await request(ctx.app).get('/tasks?limit=100').set(bearer(bob.token)).expect(200);

      const { data } = res.body as TaskListResult;
      expect(data.length).toBeGreaterThan(0);
      expect(data.every((task) => task.userId === bob.id)).toBe(true);
    });
  });

  describe('GET /tasks (listagem)', () => {
    let carol: TestUser;

    beforeAll(async () => {
      carol = await registerUser(ctx.app);
      const seed = [
        { title: 'Banana', status: 'pending', priority: 'low' },
        { title: 'Abacaxi', status: 'done', priority: 'high' },
        { title: 'Damasco', status: 'in_progress', priority: 'medium' },
        { title: 'Cereja', status: 'done', priority: 'low' },
        { title: 'Embaúba', status: 'pending', priority: 'high' },
      ];
      for (const item of seed) {
        await createTask(ctx.app, carol.token, item);
      }
    });

    it('pagina com metadados corretos', async () => {
      const page1 = await request(ctx.app)
        .get('/tasks?page=1&limit=2')
        .set(bearer(carol.token))
        .expect(200);
      const page3 = await request(ctx.app)
        .get('/tasks?page=3&limit=2')
        .set(bearer(carol.token))
        .expect(200);

      const first = page1.body as TaskListResult;
      const last = page3.body as TaskListResult;

      expect(first.meta).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
      expect(first.data).toHaveLength(2);
      expect(last.meta.page).toBe(3);
      expect(last.data).toHaveLength(1);
    });

    it('usa página 1 e limite 10 por padrão, ordenando da mais recente para a mais antiga', async () => {
      const res = await request(ctx.app).get('/tasks').set(bearer(carol.token)).expect(200);

      const { data, meta } = res.body as TaskListResult;
      expect(meta).toMatchObject({ page: 1, limit: 10, total: 5 });
      expect(data.map((t) => t.title)).toEqual([
        'Embaúba',
        'Cereja',
        'Damasco',
        'Abacaxi',
        'Banana',
      ]);
    });

    it('filtra por status e por prioridade', async () => {
      const done = await request(ctx.app)
        .get('/tasks?status=done')
        .set(bearer(carol.token))
        .expect(200);
      expect((done.body as TaskListResult).data.map((t) => t.title).sort()).toEqual([
        'Abacaxi',
        'Cereja',
      ]);

      const high = await request(ctx.app)
        .get('/tasks?priority=high')
        .set(bearer(carol.token))
        .expect(200);
      expect((high.body as TaskListResult).data.map((t) => t.title).sort()).toEqual([
        'Abacaxi',
        'Embaúba',
      ]);

      const both = await request(ctx.app)
        .get('/tasks?status=done&priority=high')
        .set(bearer(carol.token))
        .expect(200);
      expect((both.body as TaskListResult).data.map((t) => t.title)).toEqual(['Abacaxi']);
      expect((both.body as TaskListResult).meta.total).toBe(1);
    });

    it('ordena por título e por prioridade', async () => {
      const byTitle = await request(ctx.app)
        .get('/tasks?sortBy=title&order=asc')
        .set(bearer(carol.token))
        .expect(200);
      expect((byTitle.body as TaskListResult).data.map((t) => t.title)).toEqual([
        'Abacaxi',
        'Banana',
        'Cereja',
        'Damasco',
        'Embaúba',
      ]);

      const byPriority = await request(ctx.app)
        .get('/tasks?sortBy=priority&order=desc')
        .set(bearer(carol.token))
        .expect(200);
      expect((byPriority.body as TaskListResult).data.map((t) => t.priority)).toEqual([
        'high',
        'high',
        'medium',
        'low',
        'low',
      ]);
    });

    it('rejeita parâmetros de consulta inválidos com 400', async () => {
      const res = await request(ctx.app)
        .get('/tasks?page=0&limit=1000&sortBy=cor&order=cima&status=feito')
        .set(bearer(carol.token))
        .expect(400);

      const { error } = res.body as ErrorBody;
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details?.map((d) => d.path).sort()).toEqual([
        'limit',
        'order',
        'page',
        'sortBy',
        'status',
      ]);
    });
  });
});
