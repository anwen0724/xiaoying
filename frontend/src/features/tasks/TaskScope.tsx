'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, skipToken, useQuery } from '@tanstack/react-query';
import { useIdentity } from '../identity/IdentityProvider';
import { emptyTaskCache, taskCacheKey } from './task-cache';
import { TaskController } from './TaskController';
import type { Task } from './types';

const TaskContext = createContext<{ templateId?: string; authenticated: boolean; controller: TaskController } | null>(null);

export function TaskScope({ templateId, children }: { templateId?: string; children: React.ReactNode }) {
  const identity = useIdentity();
  const user = identity.session.status === 'ready' ? identity.session.user : null;
  return (
    <ScopedCache key={`${user?.id}:${identity.generation}:${templateId ?? 'all'}`}
      templateId={templateId} authenticated={user !== null}>
      {children}
    </ScopedCache>
  );
}

function ScopedCache({ children, ...scope }: { children: React.ReactNode; templateId?: string; authenticated: boolean }) {
  const identity = useIdentity();
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        gcTime: 0,
      },
    },
  }));
  const [controller] = useState(() => new TaskController(client, identity.expireIdentity, identity.refreshIdentity, scope.templateId));
  useEffect(() => {
    if (!scope.authenticated) return;
    controller.start();
    return () => controller.stop();
  }, [controller, scope.authenticated]);
  return (
    <QueryClientProvider client={client}>
      <TaskContext.Provider value={{ ...scope, controller }}>{children}</TaskContext.Provider>
    </QueryClientProvider>
  );
}

export function useTasks() {
  const scope = useContext(TaskContext);
  if (!scope) throw new Error('TaskScope is required');
  const controller = scope.controller;
  // This query only subscribes to merged entities; TaskController owns all network reads.
  const { data = emptyTaskCache } = useQuery({ queryKey: taskCacheKey, queryFn: skipToken, initialData: emptyTaskCache });
  function accepted(task: Task) {
    controller.accept(task);
  }
  return { ...scope, cache: data, accepted };
}
