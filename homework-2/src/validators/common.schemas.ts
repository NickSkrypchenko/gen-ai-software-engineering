import { z } from 'zod';

export const Email = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format')
  .max(255);

export const NonEmptyString = (max: number) => z.string().trim().min(1).max(max);
