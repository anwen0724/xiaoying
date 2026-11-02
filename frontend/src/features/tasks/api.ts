import { items, localUrl, record, requestJson, RequestError, text } from '../../shared/api/http';
import type { Task, TaskStage } from './types';

function invalid(): never {
  throw new RequestError('服务返回的任务数据无效，请重新查询。', 502, 'INVALID_RESPONSE');
}

export async function readTaskStatuses(ids: string[], signal: AbortSignal) {
  const response = record(await requestJson(`/api/tasks/status?ids=${ids.join(',')}`, { signal }));
  if (!Array.isArray(response.missingIds)) return invalid();
  return { tasks: items(response, parseTask), missingIds: response.missingIds.map(text) };
}

export async function readActiveTasks(signal: AbortSignal): Promise<Task[]> {
  return items(await requestJson('/api/tasks/active', { signal }), parseTask);
}

export async function readTaskHistory(templateId: string | undefined, cursor: string | null, signal: AbortSignal) {
  const query = new URLSearchParams({ limit: '20' });
  if (templateId) query.set('templateId', templateId);
  if (cursor) query.set('cursor', cursor);
  const page = record(await requestJson(`/api/tasks?${query}`, { signal }));
  return { tasks: items(page, parseTask), nextCursor: page.nextCursor === null ? null : text(page.nextCursor) };
}

function stage(value: unknown): TaskStage | null {
  if (value === null || value === 'MATERIAL_CHECK' || value === 'MOCK_GENERATION' || value === 'RESULT_FINALIZATION') return value;
  return invalid();
}

function timestamp(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) return invalid();
  return result;
}

export function parseTask(value: unknown): Task {
  const task = record(value);
  const status = task.status;
  if (status !== 'QUEUED' && status !== 'RUNNING' && status !== 'SUCCEEDED' && status !== 'FAILED') return invalid();
  if (typeof task.version !== 'number' || !Number.isSafeInteger(task.version) || task.version < 0) return invalid();
  const failure = task.failure === null ? null : record(task.failure);
  return {
    id: text(task.id),
    templateId: text(task.templateId),
    templateTitle: text(task.templateTitle),
    status,
    stage: stage(task.stage),
    version: task.version,
    createdAt: timestamp(task.createdAt),
    startedAt: task.startedAt === null ? null : timestamp(task.startedAt),
    finishedAt: task.finishedAt === null ? null : timestamp(task.finishedAt),
    resultUrl: task.resultUrl === null ? null : localUrl(task.resultUrl),
    failure: failure === null ? null : {
      code: text(failure.code),
      stage: stage(failure.stage),
      message: text(failure.message),
    },
  };
}
