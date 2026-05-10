import type { Request, Response, NextFunction } from 'express';
import { ticketsService } from '../services/tickets.service';
import { setETag } from '../middleware/etag';
import type { CreateTicketInput, UpdateTicketInput, ListFilters, TransitionRequest } from '../validators/ticket.schemas';

// parseIfMatch middleware attaches this before any mutating handler runs
function ifMatchVersion(req: Request): number {
  return (req as Request & { expectedVersion: number }).expectedVersion;
}

export const ticketsController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const autoClassify = req.query.auto_classify === 'true';
      const ticket = await ticketsService.create({ ...(req.body as CreateTicketInput), auto_classify: autoClassify });
      res.status(201).json(ticket);
    } catch (e) { next(e); }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ticketsService.list(req.query as unknown as ListFilters);
      res.json(result);
    } catch (e) { next(e); }
  },

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await ticketsService.findById(req.params.id);
      setETag(res, ticket.version);
      res.json(ticket);
    } catch (e) { next(e); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await ticketsService.update(req.params.id, ifMatchVersion(req), req.body as UpdateTicketInput);
      setETag(res, ticket.version);
      res.json(ticket);
    } catch (e) { next(e); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await ticketsService.delete(req.params.id, ifMatchVersion(req));
      res.status(204).end();
    } catch (e) { next(e); }
  },

  async transition(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await ticketsService.transition(req.params.id, ifMatchVersion(req), req.body as TransitionRequest);
      setETag(res, ticket.version);
      res.json(ticket);
    } catch (e) { next(e); }
  },

  async autoClassify(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ticketsService.autoClassify(req.params.id, ifMatchVersion(req));
      res.json(result);
    } catch (e) { next(e); }
  },

  async getTransitions(req: Request, res: Response, next: NextFunction) {
    try {
      const transitions = await ticketsService.getTransitions(req.params.id);
      res.json(transitions);
    } catch (e) { next(e); }
  },

  async getClassifications(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ticketsService.getClassifications(req.params.id);
      res.json(result);
    } catch (e) { next(e); }
  },
};
