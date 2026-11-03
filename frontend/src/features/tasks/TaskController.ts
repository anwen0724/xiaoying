import { QueryClient } from '@tanstack/react-query';
import { errorMessage, isAbort, RequestError } from '../../shared/api/http';
import { readActiveTasks, readTaskHistory, readTaskStatuses } from './api';
import { emptyTaskCache, mergeTasks, taskCacheKey, type TaskCache } from './task-cache';
import { isFinished, type Task } from './types';

/** One page owns polling. Epoch checks protect the cache even when transport ignores cancellation. */
export class TaskController {
  private epoch = 0;
  private live = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private round: object | null = null;
  private sequence = 0;
  private historyRequest: object | null = null;
  private activeRequest: object | null = null;

  constructor(
    private readonly client: QueryClient,
    private readonly unauthorized: () => void,
    private readonly confirmIdentity: () => Promise<void>,
    private readonly templateId?: string,
    private readonly category?: string,
  ) {}

  get snapshot(): TaskCache {
    return this.client.getQueryData<TaskCache>(taskCacheKey) ?? emptyTaskCache;
  }

  private update(change: (current: TaskCache) => TaskCache) {
    this.client.setQueryData<TaskCache>(taskCacheKey, (current = emptyTaskCache) => change(current));
  }

  start() {
    this.live = true;
    this.epoch += 1;
    document.addEventListener('visibilitychange', this.visibilityChanged);
    this.refresh();
    this.schedule(0);
  }

  stop() {
    this.live = false;
    this.epoch += 1;
    this.round = null;
    this.historyRequest = null;
    this.activeRequest = null;
    this.clearTimer();
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.client.removeQueries({ queryKey: ['transport'] });
  }

  accept(task: Task) {
    if (!this.live) return;
    this.update((current) => ({
      ...mergeTasks(current, [task]),
      pinnedIds: [...new Set([...current.pinnedIds, task.id])],
    }));
    this.schedule(0);
  }

  resume() {
    this.update((current) => ({ ...current, tracking: { status: 'idle' } }));
    this.schedule(0);
  }

  refresh() {
    this.loadHistory(false);
    this.loadActive();
  }

  async loadHistory(append: boolean) {
    if (!this.live) return;
    const cursor = append ? this.snapshot.history.cursor : null;
    if (append && (this.historyRequest || !cursor)) return;
    const epoch = this.epoch;
    const ticket = {};
    this.historyRequest = ticket;
    this.client.removeQueries({ queryKey: ['transport', 'history'] });
    const owns = () => this.live && epoch === this.epoch && this.historyRequest === ticket;
    this.update((current) => ({
      ...current,
      history: { ...current.history, read: { status: 'loading' }, loadingMore: append },
    }));
    try {
      const page = await this.client.fetchQuery({
        queryKey: ['transport', 'history', ++this.sequence],
        queryFn: ({ signal }) => readTaskHistory(this.templateId, cursor, signal, this.category),
      });
      if (!owns()) return;
      this.update((current) => ({
        ...mergeTasks(current, page.tasks),
        history: {
          ids: [...new Set([...(append ? current.history.ids : []), ...page.tasks.map((task) => task.id)])],
          cursor: page.nextCursor,
          read: { status: 'idle' },
          loaded: true,
          loadingMore: false,
        },
      }));
      this.schedule(0);
    } catch (error) {
      if (owns()) this.reportError(error, (message) => this.update((current) => ({
        ...current,
        history: {
          ...current.history,
          loadingMore: false,
          read: { status: 'error', message },
          cursor: error instanceof RequestError && error.code === 'INVALID_CURSOR' ? null : current.history.cursor,
        },
      })));
    } finally {
      if (owns()) this.historyRequest = null;
    }
  }

  async loadActive() {
    if (!this.live || this.activeRequest) return;
    const epoch = this.epoch;
    const ticket = {};
    this.activeRequest = ticket;
    const owns = () => this.live && epoch === this.epoch && this.activeRequest === ticket;
    this.update((current) => ({ ...current, activeRead: { status: 'loading' } }));
    try {
      const tasks = await this.client.fetchQuery({
        queryKey: ['transport', 'active', ++this.sequence],
        queryFn: ({ signal }) => readActiveTasks(signal, this.category),
      });
      if (!owns()) return;
      this.update((current) => ({
        ...mergeTasks(current, tasks),
        pinnedIds: [...new Set([...current.pinnedIds, ...tasks.map((task) => task.id)])],
        activeRead: { status: 'idle' },
      }));
      this.schedule(0);
    } catch (error) {
      if (owns()) this.reportError(error, (message) => this.update((current) => ({
        ...current,
        activeRead: { status: 'error', message },
      })));
    } finally {
      if (owns()) this.activeRequest = null;
    }
  }

  private reportError(error: unknown, report: (message: string) => void) {
    if (isAbort(error)) return;
    if (error instanceof RequestError && error.status === 401) this.unauthorized();
    else report(errorMessage(error));
  }

  private pendingIds() {
    return Object.values(this.snapshot.entries).filter(({ task }) => !isFinished(task)).map(({ task }) => task.id);
  }

  private clearTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(delay: number) {
    if (!this.live || this.round || document.hidden || this.snapshot.tracking.status === 'error') return;
    this.clearTimer();
    if (this.pendingIds().length === 0) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.poll();
    }, delay);
  }

  private visibilityChanged = async () => {
    this.clearTimer();
    if (document.hidden) return;
    const epoch = this.epoch;
    await this.confirmIdentity();
    if (this.live && epoch === this.epoch) this.schedule(0);
  };

  private async poll() {
    if (!this.live || this.round) return;
    const epoch = this.epoch;
    const ticket = {};
    this.round = ticket;
    const owns = () => this.live && epoch === this.epoch && this.round === ticket;
    this.update((current) => ({ ...current, tracking: { status: 'loading' } }));
    try {
      const ids = this.pendingIds();
      for (let offset = 0; offset < ids.length; offset += 100) {
        const batch = ids.slice(offset, offset + 100).filter((id) => {
          const entry = this.snapshot.entries[id];
          return entry && !isFinished(entry.task);
        });
        if (batch.length === 0) continue;
        const result = await this.client.fetchQuery({
          queryKey: ['transport', 'status', ++this.sequence],
          queryFn: ({ signal }) => readTaskStatuses(batch, signal),
        });
        if (!owns()) return;
        this.update((current) => {
          const merged = mergeTasks(current, result.tasks);
          const entries = { ...merged.entries };
          const missing = { ...merged.missing };
          for (const id of result.missingIds) {
            const entry = entries[id];
            if (entry) missing[id] = { templateId: entry.task.templateId, createdAt: entry.task.createdAt };
            delete entries[id];
          }
          return { ...merged, entries, missing };
        });
      }
      if (owns()) this.update((current) => ({ ...current, tracking: { status: 'idle' } }));
    } catch (error) {
      if (owns()) this.reportError(error, (message) => this.update((current) => ({
        ...current,
        tracking: { status: 'error', message },
      })));
    } finally {
      if (owns()) {
        this.round = null;
        this.schedule(2000);
      }
    }
  }
}
