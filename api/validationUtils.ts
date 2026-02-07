import type { ZodError, ZodType, ZodTypeDef } from 'zod';
import { ValidationError } from '../core/errors';

type ZodIssueDetails = {
  issues: ZodError['issues'];
  fieldErrors: Record<string, string[] | undefined>;
  formErrors: string[];
};

function formatZodError(error: ZodError): ZodIssueDetails {
  const flattened = error.flatten();
  return {
    issues: error.issues,
    fieldErrors: flattened.fieldErrors,
    formErrors: flattened.formErrors,
  };
}

export function parseWithSchema<Output, Input>(
  schema: ZodType<Output, ZodTypeDef, Input>,
  value: unknown,
  field: string,
): Output {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  throw new ValidationError(`Invalid ${field} response`, field, {
    details: formatZodError(result.error),
  });
}
