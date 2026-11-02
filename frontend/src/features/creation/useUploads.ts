'use client';

/** Owns per-slot requests and object URLs. Unmounting the form invalidates every callback. */
import { useEffect, useRef, useState } from 'react';
import { errorMessage, isAbort, RequestError } from '../../shared/api/http';
import type { Template } from '../templates/types';
import { uploadAsset } from './api';
import type { UploadSlot } from './types';

export function useUploads(template: Template, onUnauthorized: () => void) {
  const [slots, setSlots] = useState<UploadSlot[]>(() => Array.from(
    { length: template.requiredImageCount }, (_, position) => ({ id: `${template.id}-${position + 1}`, status: 'empty' }),
  ));
  const requests = useRef(new Map<string, AbortController>());
  const previews = useRef(new Map<string, string>());
  const alive = useRef(false);

  useEffect(() => {
    alive.current = true;
    const controllers = requests.current;
    const urls = previews.current;
    return () => {
      alive.current = false;
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  function update(slot: UploadSlot) {
    setSlots((current) => current.map((existing) => existing.id === slot.id ? slot : existing));
  }

  function release(id: string) {
    requests.current.get(id)?.abort();
    requests.current.delete(id);
    const previous = previews.current.get(id);
    if (previous) URL.revokeObjectURL(previous);
    previews.current.delete(id);
  }

  function remove(id: string) {
    release(id);
    update({ id, status: 'empty' });
  }

  /** A replacement cancels transport and removes ownership before starting the next upload. */
  async function choose(id: string, file: File) {
    release(id);
    let validation = '';
    if (!template.acceptedMimeTypes.includes(file.type)) {
      validation = `请选择 ${template.acceptedMimeTypes.map((mime) => mime.replace('image/', '').toUpperCase()).join(' / ')} 图片。`;
    } else if (file.size === 0) {
      validation = '图片内容为空，请重新选择。';
    } else if (file.size > template.maxFileSizeBytes) {
      validation = `图片超过 ${template.maxFileSizeBytes / 1024 / 1024} MiB，请选择较小的图片。`;
    }
    if (validation) {
      update({ id, status: 'failed', file, preview: null, message: validation, retryable: false });
      return;
    }
    const preview = URL.createObjectURL(file);
    previews.current.set(id, preview);
    const controller = new AbortController();
    requests.current.set(id, controller);
    update({ id, status: 'uploading', file, preview });
    const ownsResponse = () => alive.current && !controller.signal.aborted && requests.current.get(id) === controller;
    try {
      const asset = await uploadAsset(template.id, file, controller.signal);
      if (ownsResponse()) update({ id, status: 'ready', file, preview, asset });
    } catch (error) {
      if (!ownsResponse() || isAbort(error)) return;
      if (error instanceof RequestError && error.status === 401) {
        onUnauthorized();
        return;
      }
      update({ id, status: 'failed', file, preview, message: errorMessage(error), retryable: true });
    } finally {
      if (requests.current.get(id) === controller) requests.current.delete(id);
    }
  }

  return { slots, choose, remove };
}
