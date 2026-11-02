'use client';

import { useEffect, useRef, useState } from 'react';
import { errorMessage, isAbort, RequestError } from '../../shared/api/http';
import { createTask } from './api';
import type { Submission } from './types';
import type { Task } from '../tasks/types';

/** A synchronous request owner prevents duplicate writes before React renders disabled controls. */
export function useSubmission(templateId: string, onUnauthorized: () => void, onAccepted: (task: Task) => void) {
  const [submission, setSubmission] = useState<Submission>({ status: 'idle' });
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => {
    request.current?.abort();
    request.current = null;
  }, []);

  function clear(): boolean {
    if (request.current) return false;
    setSubmission({ status: 'idle' });
    return true;
  }

  async function submit(assetIds: string[]) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setSubmission({ status: 'submitting' });
    const ownsResponse = () => !controller.signal.aborted && request.current === controller;
    try {
      const task = await createTask(templateId, assetIds, controller.signal);
      if (ownsResponse()) {
        onAccepted(task);
        setSubmission({ status: 'accepted', taskId: task.id });
      }
    } catch (error) {
      if (!ownsResponse() || isAbort(error)) return;
      if (error instanceof RequestError && error.status === 401) {
        onUnauthorized();
        return;
      }
      const uncertain = !(error instanceof RequestError) || error.status === 0 || error.status >= 500;
      setSubmission({ status: 'failed', message: errorMessage(error), uncertain });
    } finally {
      if (request.current === controller) request.current = null;
    }
  }

  return { submission, submit, clear };
}
