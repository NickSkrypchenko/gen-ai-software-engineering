import { Request, Response, NextFunction } from 'express';
import { TransactionsService } from '../services/transactions.service';
import { toCSV } from '../services/export.service';
import { ListFilters } from '../models/transaction.types';
import { NotFoundError } from '../utils/http-errors';

export class TransactionsController {
  constructor(private readonly service: TransactionsService) {
    this.create = this.create.bind(this);
    this.list = this.list.bind(this);
    this.getById = this.getById.bind(this);
    this.exportCSV = this.exportCSV.bind(this);
  }

  create(req: Request, res: Response, next: NextFunction): void {
    try {
      const txn = this.service.create(
        req.body,
        req.headers['x-request-id'] as string,
      );
      res.status(201).json(txn);
    } catch (err) {
      next(err);
    }
  }

  list(req: Request, res: Response, next: NextFunction): void {
    try {
      const filters = req.query as unknown as ListFilters;
      const data = this.service.list(filters);
      res.json({ data, count: data.length });
    } catch (err) {
      next(err);
    }
  }

  getById(req: Request, res: Response, next: NextFunction): void {
    try {
      const txn = this.service.getById(req.params.id);
      if (!txn) return next(new NotFoundError(`Transaction ${req.params.id} not found`));
      res.json(txn);
    } catch (err) {
      next(err);
    }
  }

  exportCSV(req: Request, res: Response, next: NextFunction): void {
    try {
      const filters = req.query as unknown as ListFilters;
      const data = this.service.list(filters);
      const csv = toCSV(data);
      const filename = `transactions-${new Date().toISOString()}.csv`;
      res
        .status(200)
        .setHeader('Content-Type', 'text/csv')
        .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        .send(csv);
    } catch (err) {
      next(err);
    }
  }
}
