import { describe, test, expect } from 'vitest';
import {
  ValidationError,
  NotFoundError,
  InvalidTransitionError,
  VersionConflictError,
  PreconditionRequiredError,
  ParseError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  MissingFormatError,
} from './http-errors';

describe('HttpError subclasses', () => {
  test('ValidationError has statusCode 400 and code VALIDATION_ERROR', () => {
    const e = new ValidationError([{ field: 'email', message: 'invalid' }]);
    expect(e.statusCode).toBe(400);
    expect(e.code).toBe('VALIDATION_ERROR');
    expect(e.details).toHaveLength(1);
  });

  test('NotFoundError has statusCode 404', () => {
    const e = new NotFoundError('abc');
    expect(e.statusCode).toBe(404);
    expect(e.code).toBe('NOT_FOUND');
    expect(e.message).toContain('abc');
  });

  test('InvalidTransitionError has statusCode 422 and exposes allowed', () => {
    const e = new InvalidTransitionError('closed', 'resolved', ['in_progress']);
    expect(e.statusCode).toBe(422);
    expect(e.code).toBe('INVALID_TRANSITION');
    expect(e.allowed).toEqual(['in_progress']);
    expect(e.details).toBeDefined();
  });

  test('VersionConflictError has statusCode 412 and exposes versions', () => {
    const e = new VersionConflictError(5, 3);
    expect(e.statusCode).toBe(412);
    expect(e.code).toBe('VERSION_CONFLICT');
    expect(e.current_version).toBe(5);
    expect(e.your_version).toBe(3);
  });

  test('PreconditionRequiredError has statusCode 428', () => {
    expect(new PreconditionRequiredError().statusCode).toBe(428);
  });

  test('ParseError has statusCode 400', () => {
    expect(new ParseError('bad file').statusCode).toBe(400);
  });

  test('PayloadTooLargeError has statusCode 413', () => {
    expect(new PayloadTooLargeError('too big').statusCode).toBe(413);
  });

  test('UnsupportedMediaTypeError has statusCode 415', () => {
    expect(new UnsupportedMediaTypeError().statusCode).toBe(415);
  });

  test('MissingFormatError has statusCode 400', () => {
    expect(new MissingFormatError().statusCode).toBe(400);
  });
});
