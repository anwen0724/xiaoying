import type { Task } from '../../src/features/tasks/types';

/** Contract examples for controlled HTTP failures and ordering, not a replacement task engine. */
export function taskFixture(number: number, overrides: Partial<Task> = {}): Task {
  return {
    id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
    templateId: 'mountain-card', templateTitle: '山野明信片', status: 'QUEUED', stage: null,
    version: 0, createdAt: '2026-11-02T06:00:00.000Z', startedAt: null, finishedAt: null,
    resultUrl: null, failure: null, ...overrides,
  };
}

export function failedTask(number: number, overrides: Partial<Task> = {}): Task {
  return taskFixture(number, {
    status: 'FAILED', version: 3, stage: 'MOCK_GENERATION', finishedAt: '2026-11-02T06:00:02.000Z',
    failure: { code: 'SIMULATED_FAILURE', stage: 'MOCK_GENERATION', message: '演示生成失败' }, ...overrides,
  });
}
