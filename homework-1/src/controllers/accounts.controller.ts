import { Request, Response, NextFunction } from 'express';
import { AccountsService } from '../services/accounts.service';

export class AccountsController {
  constructor(private readonly service: AccountsService) {
    this.getBalance = this.getBalance.bind(this);
    this.getSummary = this.getSummary.bind(this);
  }

  getBalance(req: Request, res: Response, next: NextFunction): void {
    try {
      const result = this.service.getBalances(req.params.accountId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  getSummary(req: Request, res: Response, next: NextFunction): void {
    try {
      const result = this.service.getSummary(req.params.accountId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}
