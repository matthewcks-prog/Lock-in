import { z } from 'zod';
import { parseWithSchema } from './validationUtils';

const OptionalString = z.string().nullable().optional();

export const TaskRecordSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: OptionalString,
    completed: z.boolean().optional(),
    completed_at: OptionalString,
    due_date: OptionalString,
    course_code: OptionalString,
    source_url: OptionalString,
    sort_order: z.number().optional(),
    workflow_status: OptionalString,
    week: z.number().nullable().optional(),
    created_at: OptionalString,
    createdAt: OptionalString,
    updated_at: OptionalString,
    updatedAt: OptionalString,
  })
  .passthrough();

export type TaskRecord = z.infer<typeof TaskRecordSchema>;

export const TaskRecordsSchema = z.array(TaskRecordSchema);

export function validateTaskRecord(value: unknown, field = 'task'): TaskRecord {
  return parseWithSchema(TaskRecordSchema, value, field);
}

export function validateTaskRecords(value: unknown, field = 'tasks'): TaskRecord[] {
  return parseWithSchema(TaskRecordsSchema, value, field);
}
