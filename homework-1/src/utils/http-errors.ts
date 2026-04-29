export interface ErrorDetail {
  field: string;
  message: string;
}

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class ValidationError extends HttpError {
  constructor(details: ErrorDetail[]) {
    super(400, 'VALIDATION_ERROR', 'Validation failed', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not found') {
    super(404, 'NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict') {
    super(409, 'CONFLICT', message);
    this.name = 'ConflictError';
  }
}
