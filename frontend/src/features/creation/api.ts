import { localUrl, positiveInteger, record, requestJson, RequestError, text } from '../../shared/api/http';
import type { Asset, TaskReceipt } from './types';

export async function uploadAsset(templateId: string, file: File, signal: AbortSignal): Promise<Asset> {
  const body = new FormData();
  body.set('templateId', templateId);
  body.set('file', file);
  const asset = record(await requestJson('/api/assets', { method: 'POST', body, signal }));
  return {
    id: text(asset.id),
    originalName: text(asset.originalName),
    mimeType: text(asset.mimeType),
    sizeBytes: positiveInteger(asset.sizeBytes),
    previewUrl: localUrl(asset.previewUrl),
  };
}

export async function createTask(templateId: string, assetIds: string[], signal: AbortSignal): Promise<TaskReceipt> {
  const task = record(await requestJson('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId, assetIds }),
    signal,
  }));
  const status = task.status;
  if (status !== 'QUEUED' && status !== 'RUNNING' && status !== 'SUCCEEDED' && status !== 'FAILED') {
    throw new RequestError('服务返回的任务状态无效。', 502, 'INVALID_RESPONSE');
  }
  return {
    id: text(task.id),
    templateTitle: text(task.templateTitle),
    status,
    failure: task.failure === null ? null : { message: text(record(task.failure).message) },
  };
}
