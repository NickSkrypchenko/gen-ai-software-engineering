import { Router } from 'express';
import { ticketsController } from '../controllers/tickets.controller';
import { parseIfMatch } from '../middleware/etag';
import { validate } from '../middleware/validate';
import {
  CreateTicketSchema,
  UpdateTicketSchema,
  TransitionRequestSchema,
  ListFiltersSchema,
} from '../validators/ticket.schemas';

export const ticketsRouter = Router();

ticketsRouter.post('/tickets', validate(CreateTicketSchema), ticketsController.create);
ticketsRouter.get('/tickets', validate(ListFiltersSchema, 'query'), ticketsController.list);
ticketsRouter.get('/tickets/:id', ticketsController.findById);
ticketsRouter.put('/tickets/:id', parseIfMatch, validate(UpdateTicketSchema), ticketsController.update);
ticketsRouter.delete('/tickets/:id', parseIfMatch, ticketsController.delete);
ticketsRouter.post('/tickets/:id/transitions', parseIfMatch, validate(TransitionRequestSchema), ticketsController.transition);
ticketsRouter.post('/tickets/:id/auto-classify', parseIfMatch, ticketsController.autoClassify);
ticketsRouter.get('/tickets/:id/transitions', ticketsController.getTransitions);
ticketsRouter.get('/tickets/:id/classifications', ticketsController.getClassifications);
