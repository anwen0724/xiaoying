'use client';

/** Owns the confirmed session and invalidates private forms before identity mutations. */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../shared/api/http';
import { currentUser, selectUser } from './api';
import type { SessionState } from './types';

type IdentityContextValue = {
  session: SessionState;
  generation: number;
  notice: string;
  changeIdentity: (id: string | null) => Promise<void>;
  refreshIdentity: () => Promise<void>;
  expireIdentity: () => void;
};

const IdentityContext = createContext<IdentityContextValue | null>(null);

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: 'loading' });
  const [generation, setGeneration] = useState(0);
  const [notice, setNotice] = useState('');
  const current = useRef<SessionState>({ status: 'loading' });
  const mounted = useRef(false);
  const readVersion = useRef(0);
  const mutationPending = useRef(false);

  const update = useCallback((next: SessionState) => {
    current.current = next;
    setSession(next);
  }, []);

  const refreshIdentity = useCallback(async () => {
    if (mutationPending.current) return;
    const version = ++readVersion.current;
    try {
      const user = await currentUser();
      if (!mounted.current || version !== readVersion.current) return;
      const previous = current.current;
      if (previous.status !== 'ready' || previous.user?.id !== user?.id) {
        setGeneration((value) => value + 1);
      }
      update({ status: 'ready', user });
    } catch (error) {
      if (!mounted.current || version !== readVersion.current) return;
      setGeneration((value) => value + 1);
      update({ status: 'error', message: errorMessage(error) });
    }
  }, [update]);

  /** Session writes are serialized because a late Set-Cookie can change the browser identity. */
  const changeIdentity = useCallback(async (id: string | null) => {
    if (mutationPending.current) return;
    mutationPending.current = true;
    readVersion.current += 1;
    setGeneration((value) => value + 1);
    setNotice('');
    update({ status: 'changing' });
    try {
      const user = await selectUser(id);
      if (mounted.current) update({ status: 'ready', user });
    } catch (error) {
      if (!mounted.current) return;
      // A failed response does not prove that the session mutation failed on the server.
      try {
        const user = await currentUser();
        if (mounted.current) {
          update({ status: 'ready', user });
          setNotice(`${errorMessage(error)} 已重新确认当前身份。`);
        }
      } catch (checkError) {
        if (mounted.current) update({ status: 'error', message: errorMessage(checkError) });
      }
    } finally {
      mutationPending.current = false;
    }
  }, [update]);

  const expireIdentity = useCallback(() => {
    readVersion.current += 1;
    setGeneration((value) => value + 1);
    setNotice('会话已失效，请重新选择身份。');
    update({ status: 'ready', user: null });
  }, [update]);

  useEffect(() => {
    mounted.current = true;
    // refreshIdentity updates state only after currentUser resolves; no synchronous effect update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshIdentity();
    const onFocus = () => { refreshIdentity(); };
    window.addEventListener('focus', onFocus);
    return () => {
      mounted.current = false;
      readVersion.current += 1;
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshIdentity]);

  return (
    <IdentityContext.Provider value={{ session, generation, notice, changeIdentity, refreshIdentity, expireIdentity }}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity(): IdentityContextValue {
  const context = useContext(IdentityContext);
  if (!context) throw new Error('IdentityProvider is required');
  return context;
}
