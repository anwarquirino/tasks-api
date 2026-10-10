import type { Request, Response } from 'express';
import { currentUser } from '../../middlewares/auth.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import type { AuthService } from './auth.service.js';

export function createAuthController(service: AuthService) {
  return {
    register: async (req: Request, res: Response): Promise<void> => {
      const result = await service.register(req.body as RegisterInput);
      res.status(201).json(result);
    },

    login: async (req: Request, res: Response): Promise<void> => {
      const result = await service.login(req.body as LoginInput);
      res.json(result);
    },

    me: async (req: Request, res: Response): Promise<void> => {
      const profile = await service.getProfile(currentUser(req).id);
      res.json(profile);
    },
  };
}
