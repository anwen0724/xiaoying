'use client';

import { useEffect, useState } from 'react';
import { errorMessage, isAbort } from '../../shared/api/http';
import { demoUsers } from './api';
import { useIdentity } from './IdentityProvider';
import type { User } from './types';
import styles from './identity.module.css';

type UserList = { status: 'loading' } | { status: 'ready'; users: User[] } | { status: 'error'; message: string };

export function IdentityPicker() {
  const { session, notice, changeIdentity, refreshIdentity } = useIdentity();
  const [list, setList] = useState<UserList>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    demoUsers(controller.signal).then(
      (users) => { if (!controller.signal.aborted) setList({ status: 'ready', users }); },
      (error: unknown) => {
        if (!controller.signal.aborted && !isAbort(error)) setList({ status: 'error', message: errorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  const user = session.status === 'ready' ? session.user : null;
  return (
    <div className={styles.identity}>
      <div className={styles.controls}>
        <label htmlFor="demo-identity">演示身份</label>
        <select id="demo-identity" value={user?.id ?? ''}
          disabled={list.status !== 'ready' || session.status !== 'ready'}
          onChange={async (event) => { await changeIdentity(event.target.value || null); }}>
          <option value="">选择身份</option>
          {list.status === 'ready' && list.users.map((item) => (
            <option key={item.id} value={item.id}>{item.displayName}</option>
          ))}
        </select>
        {user && <button type="button" onClick={async () => { await changeIdentity(null); }}>退出身份</button>}
      </div>
      <div className={styles.status} aria-live="polite">
        {session.status === 'loading' && <span>正在确认身份…</span>}
        {session.status === 'changing' && <span>正在切换身份…</span>}
        {user && <span>当前身份：{user.displayName}</span>}
        {session.status === 'error' && <>
          <span role="alert">身份未确认：{session.message}</span>
          <button type="button" onClick={async () => { await refreshIdentity(); }}>重试确认身份</button>
        </>}
        {list.status === 'error' && <>
          <span role="alert">身份列表加载失败：{list.message}</span>
          <button type="button" onClick={() => { setList({ status: 'loading' }); setAttempt((value) => value + 1); }}>
            重试身份列表
          </button>
        </>}
        {notice && <span role="status">{notice}</span>}
      </div>
    </div>
  );
}
