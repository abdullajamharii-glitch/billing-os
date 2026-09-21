import { ZodSchema } from 'zod';
import { badRequest } from './api-response';

export function validateBody<T>(
  schema: ZodSchema<T>,
  body: unknown
): { data: T; error: null } | { data: null; error: ReturnType<typeof badRequest> } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const errors = result.error.flatten();
    return { data: null, error: badRequest('Validation failed', errors) };
  }
  return { data: result.data, error: null };
}
