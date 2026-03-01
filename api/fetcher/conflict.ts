import { ConflictError } from '../../core/errors';
import { HTTP_STATUS } from './constants';

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null;
}

async function extractConflictVersion(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body)) {
      if (typeof body['updatedAt'] === 'string') {
        return body['updatedAt'];
      }
      if (typeof body['updated_at'] === 'string') {
        return body['updated_at'];
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function maybeThrowConflictError(response: Response): Promise<void> {
  if (response.status !== HTTP_STATUS.CONFLICT) return;
  const serverVersion = await extractConflictVersion(response);
  throw new ConflictError(
    'Note was modified by another session. Please refresh and try again.',
    serverVersion,
  );
}
