/**
 * Runtime validation utilities for adapter responses
 * Validates and safely coerces data to ensure contract compliance
 */
import { z, ZodSchema } from 'zod';
import {
  JobSchema,
  EvidenceSchema,
  ActivitySchema,
  TimeEntrySchema,
  BlockerSchema,
  ChatMessageSchema,
  LabelRecordSchema,
  AuditLogSchema,
} from './schemas';
import type {
  Job,
  Evidence,
  Activity,
  TimeEntry,
  Blocker,
  ChatMessage,
  LabelRecord,
  AuditLog,
  ValidationResult,
} from '../types';

/**
 * Validates data against a schema and returns typed result with errors
 */
export function validate<T>(
  schema: ZodSchema,
  data: unknown,
  context?: string
): ValidationResult<T> {
  try {
    const result = schema.parse(data);
    return { success: true, data: result as T };
  } catch (err) {
    const issues = err instanceof z.ZodError ? err.issues : [];
    const errors = issues.reduce(
      (acc, issue) => {
        const path = issue.path.join('.');
        acc[path || 'root'] = issue.message;
        return acc;
      },
      {} as Record<string, string>
    );

    console.error(
      `[Validation] ${context || 'Unknown'} validation failed:`,
      errors
    );

    return {
      success: false,
      errors,
    };
  }
}

/**
 * Safe validation wrapper: validates and returns data or safe fallback
 */
export function validateOrFallback<T>(
  schema: ZodSchema,
  data: unknown,
  fallback: T,
  context?: string
): T {
  const result = validate<T>(schema, data, context);
  if (result.success && result.data) {
    return result.data;
  }
  console.warn(`[Validation] Using fallback for ${context || 'unknown'}`);
  return fallback;
}

/**
 * Validates array of items, filtering out invalid entries
 */
export function validateArray<T>(
  schema: ZodSchema,
  items: unknown[],
  context?: string
): T[] {
  if (!Array.isArray(items)) {
    console.warn(`[Validation] Expected array for ${context}`);
    return [];
  }

  const valid: T[] = [];
  items.forEach((item, idx) => {
    const result = validate<T>(schema, item, `${context}[${idx}]`);
    if (result.success && result.data) {
      valid.push(result.data);
    }
  });

  if (valid.length < items.length) {
    console.warn(
      `[Validation] Filtered ${items.length - valid.length} invalid items from ${context}`
    );
  }

  return valid;
}

// ── Specific validators for common entities ──

export function validateJob(data: unknown): ValidationResult<Job> {
  return validate<Job>(JobSchema, data, 'Job');
}

export function validateJobOrFallback(
  data: unknown,
  fallback: Job
): Job {
  return validateOrFallback<Job>(JobSchema, data, fallback, 'Job');
}

export function validateJobs(data: unknown[]): Job[] {
  return validateArray<Job>(JobSchema, data, 'Jobs[]');
}

export function validateEvidence(data: unknown): ValidationResult<Evidence> {
  return validate<Evidence>(EvidenceSchema, data, 'Evidence');
}

export function validateEvidenceOrFallback(
  data: unknown,
  fallback: Evidence
): Evidence {
  return validateOrFallback<Evidence>(EvidenceSchema, data, fallback, 'Evidence');
}

export function validateEvidenceList(data: unknown[]): Evidence[] {
  return validateArray<Evidence>(EvidenceSchema, data, 'Evidence[]');
}

export function validateActivity(data: unknown): ValidationResult<Activity> {
  return validate<Activity>(ActivitySchema, data, 'Activity');
}

export function validateActivityList(data: unknown[]): Activity[] {
  return validateArray<Activity>(ActivitySchema, data, 'Activity[]');
}

export function validateTimeEntry(data: unknown): ValidationResult<TimeEntry> {
  return validate<TimeEntry>(TimeEntrySchema, data, 'TimeEntry');
}

export function validateTimeEntryList(data: unknown[]): TimeEntry[] {
  return validateArray<TimeEntry>(TimeEntrySchema, data, 'TimeEntry[]');
}

export function validateBlocker(data: unknown): ValidationResult<Blocker> {
  return validate<Blocker>(BlockerSchema, data, 'Blocker');
}

export function validateBlockerList(data: unknown[]): Blocker[] {
  return validateArray<Blocker>(BlockerSchema, data, 'Blocker[]');
}

export function validateChatMessage(data: unknown): ValidationResult<ChatMessage> {
  return validate<ChatMessage>(ChatMessageSchema, data, 'ChatMessage');
}

export function validateChatMessageList(data: unknown[]): ChatMessage[] {
  return validateArray<ChatMessage>(ChatMessageSchema, data, 'ChatMessage[]');
}

export function validateLabelRecord(data: unknown): ValidationResult<LabelRecord> {
  return validate<LabelRecord>(LabelRecordSchema, data, 'LabelRecord');
}

export function validateLabelRecordList(data: unknown[]): LabelRecord[] {
  return validateArray<LabelRecord>(LabelRecordSchema, data, 'LabelRecord[]');
}

export function validateAuditLog(data: unknown): ValidationResult<AuditLog> {
  return validate<AuditLog>(AuditLogSchema, data, 'AuditLog');
}

export function validateAuditLogList(data: unknown[]): AuditLog[] {
  return validateArray<AuditLog>(AuditLogSchema, data, 'AuditLog[]');
}

/**
 * Creates a safe adapter wrapper that validates responses
 * Usage:
 *   const safeAdapter = createSafeAdapter(baseAdapter);
 *   const job = await safeAdapter.getJob(id); // validated Job
 */
export function createSafeAdapter<T extends Record<string, any>>(
  adapter: T,
  validators: Record<string, { schema: ZodSchema; isList?: boolean }>
): T {
  return new Proxy(adapter, {
    get: (target, prop: string | symbol) => {
      const fn = target[prop as keyof T];
      if (typeof fn !== 'function') return fn;

      const validator = validators[prop as string];
      if (!validator) return fn;

      return async (...args: any[]) => {
        try {
          const result = await fn.apply(target, args);
          if (validator.isList) {
            return validateArray(validator.schema, result, `${String(prop)}`);
          } else {
            const validation = validate(validator.schema, result, `${String(prop)}`);
            return validation.success ? validation.data : result;
          }
        } catch (err) {
          console.error(`[SafeAdapter] Error in ${String(prop)}:`, err);
          throw err;
        }
      };
    },
  }) as T;
}