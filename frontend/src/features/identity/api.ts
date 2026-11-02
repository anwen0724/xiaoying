import { items, record, requestJson, text, RequestError } from '../../shared/api/http';
import type { User } from './types';

function parseUser(value: unknown): User {
  const user = record(value);
  return { id: text(user.id), displayName: text(user.displayName) };
}

export async function currentUser(): Promise<User | null> {
  try {
    return parseUser(await requestJson('/api/session'));
  } catch (error) {
    if (error instanceof RequestError && error.status === 401) return null;
    throw error;
  }
}

export async function demoUsers(signal: AbortSignal): Promise<User[]> {
  return items(await requestJson('/api/demo-users', { signal }), parseUser);
}

export async function selectUser(userId: string | null): Promise<User | null> {
  if (userId === null) {
    await requestJson('/api/session', { method: 'DELETE' });
    return null;
  }
  return parseUser(await requestJson('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  }));
}
