import { ticketRepository } from '../repository/ticket.repository';
import { transitionRepository } from '../repository/transition.repository';
import { classificationRepository } from '../repository/classification.repository';
import { classifyService } from './classify.service';
import { transition as domainTransition } from '../domain/ticket-state-machine';
import { clock } from '../utils/clock';
import type { CreateTicketInput, UpdateTicketInput, ListFilters, TransitionRequest } from '../validators/ticket.schemas';
import type { Ticket } from '../domain/ticket';

export const ticketsService = {
  async create(input: CreateTicketInput & { auto_classify?: boolean }) {
    const ticket = await ticketRepository.create(input);
    if (input.auto_classify) {
      const { ticket: classified } = await classifyService.autoClassify(ticket.id, ticket.version);
      return classified;
    }
    return ticket;
  },

  async list(filters: ListFilters) {
    return ticketRepository.list(filters);
  },

  async findById(id: string) {
    return ticketRepository.findById(id);
  },

  async update(id: string, expectedVersion: number, input: UpdateTicketInput) {
    return ticketRepository.update(id, expectedVersion, input);
  },

  async delete(id: string, expectedVersion: number) {
    return ticketRepository.delete(id, expectedVersion);
  },

  async transition(id: string, expectedVersion: number, body: TransitionRequest) {
    const current = await ticketRepository.findById(id);
    // Domain fn validates the transition and computes resolved_at side-effects
    const domainResult = domainTransition(current as Ticket, body.to, clock.now());
    return ticketRepository.transition(
      id,
      body.to,
      expectedVersion,
      domainResult.ticket.resolved_at,
      body.reason,
    );
  },

  async autoClassify(id: string, expectedVersion: number) {
    return classifyService.autoClassify(id, expectedVersion);
  },

  async getTransitions(id: string) {
    await ticketRepository.findById(id);
    return transitionRepository.findByTicketId(id);
  },

  async getClassifications(id: string) {
    await ticketRepository.findById(id);
    return classificationRepository.findByTicketId(id);
  },
};
