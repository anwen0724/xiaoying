export type User = { id: string; displayName: string };

export type SessionState =
  | { status: 'loading' }
  | { status: 'ready'; user: User | null }
  | { status: 'changing' }
  | { status: 'error'; message: string };
