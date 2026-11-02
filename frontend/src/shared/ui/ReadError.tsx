'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import styles from './feedback.module.css';

export function ReadError({ title, message }: { title: string; message: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className={styles.feedback} role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
      <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
        {pending ? '正在重新加载…' : '重试加载'}
      </button>
    </div>
  );
}
