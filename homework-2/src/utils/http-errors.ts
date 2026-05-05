export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown[],
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class ValidationError extends HttpError {
  constructor(details: { field?: string; message: string }[]) {
    super(400, 'VALIDATION_ERROR', 'Validation failed', details);
  }
}

export class ParseError extends HttpError {
  constructor(message: string) {
    super(400, 'PARSE_ERROR', message);
  }
}

export class MissingFormatError extends HttpError {
  constructor() {
    super(400, 'MISSING_FORMAT', 'Query param ?format=csv|json|xml is required');
  }
}

export class NotFoundError extends HttpError {
  constructor(id: string) {
    super(404, 'NOT_FOUND', `Ticket ${id} not found`);
  }
}

export class PreconditionRequiredError extends HttpError {
  constructor() {
    super(428, 'PRECONDITION_REQUIRED', 'If-Match header required for mutations');
  }
}

export class VersionConflictError extends HttpError {
  public readonly current_version: number;
  public readonly your_version: number;

  constructor(currentVersion: number, yourVersion: number) {
    super(412, 'VERSION_CONFLICT', 'Version conflict');
    this.current_version = currentVersion;
    this.your_version = yourVersion;
  }
}

export class PayloadTooLargeError extends HttpError {
  constructor(message: string) {
    super(413, 'PAYLOAD_TOO_LARGE', message);
  }
}

export class UnsupportedMediaTypeError extends HttpError {
  constructor() {
    super(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json or multipart/form-data');
  }
}

export class InvalidTransitionError extends HttpError {
  public readonly allowed: string[];

  constructor(from: string, to: string, allowed: string[]) {
    super(422, 'INVALID_TRANSITION', 'Invalid status transition', [
      {
        field: 'status',
        from,
        to,
        message: `Cannot transition from '${from}' to '${to}'. ${
          allowed.length > 0
            ? `Allowed: ${allowed.map(s => `'${s}'`).join(', ')}`
            : 'No transitions available from this status.'
        }`,
      },
    ]);
    this.allowed = allowed;
  }
}
