import type { Task } from './types';
import { isFinished } from './types';

export type TaskEntry = { task: Task; checkedAt: string };
export type ReadState = { status: 'idle' | 'loading' } | { status: 'error'; message: string };
export type TaskCache = {
  entries: Record<string, TaskEntry>;
  missing: Record<string, { templateId: string; createdAt: string }>;
  anomaly: string | null;
  tracking: ReadState;
  activeRead: ReadState;
  pinnedIds: string[];
  history: { ids: string[]; cursor: string | null; read: ReadState; loaded: boolean; loadingMore: boolean };
};
export const emptyTaskCache: TaskCache = {
  entries: {},
  missing: {},
  anomaly: null,
  tracking: { status: 'idle' },
  activeRead: { status: 'idle' },
  pinnedIds: [],
  history: { ids: [], cursor: null, read: { status: 'idle' }, loaded: false, loadingMore: false },
};
export const taskCacheKey = ['task-entities'];

/** All responses merge here; older queries cannot undo a newer task snapshot. */
export function mergeTasks(current: TaskCache, incoming: Task[]): TaskCache {
  const entries = { ...current.entries };
  let anomaly = current.anomaly;
  const checkedAt = new Date().toISOString();
  for (const task of incoming) {
    if (current.missing[task.id]) continue;
    const previous = entries[task.id];
    if (previous && task.version < previous.task.version) continue;
    if (previous && isFinished(previous.task) && task.status !== previous.task.status) {
      anomaly = '任务数据前后不一致，已保留最后确认的完成状态。';
      continue;
    }
    entries[task.id] = { task: previous && task.version === previous.task.version ? previous.task : task, checkedAt };
  }
  return { ...current, entries, anomaly };
}
