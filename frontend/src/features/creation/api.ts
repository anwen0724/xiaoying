import { localUrl, positiveInteger, record, requestJson, text } from '../../shared/api/http';
import { parseTask } from '../tasks/api';
import type { Task } from '../tasks/types';
import type { Asset } from './types';

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

export async function createTask(templateId: string, assetIds: string[], signal: AbortSignal): Promise<Task> {
  return parseTask(await requestJson('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId, assetIds }),
    signal,
  }));
}
