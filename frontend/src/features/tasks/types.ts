export type TaskStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
export type TaskStage = 'MATERIAL_CHECK' | 'MOCK_GENERATION' | 'RESULT_FINALIZATION';

export type Task = {
  id: string;
  templateId: string;
  templateTitle: string;
  status: TaskStatus;
  stage: TaskStage | null;
  version: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  resultUrl: string | null;
  failure: { code: string; stage: TaskStage | null; message: string } | null;
};

export const statusLabels: Record<TaskStatus, string> = {
  QUEUED: '等待处理', RUNNING: '处理中', SUCCEEDED: '制作成功', FAILED: '制作失败',
};
export const stageLabels: Record<TaskStage, string> = {
  MATERIAL_CHECK: '素材检查', MOCK_GENERATION: '模拟生成', RESULT_FINALIZATION: '结果整理',
};

export function isFinished(task: Task): boolean {
  return task.status === 'SUCCEEDED' || task.status === 'FAILED';
}
