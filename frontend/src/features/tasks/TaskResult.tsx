'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useIdentity } from '../identity/IdentityProvider';
import { isAbort, RequestError } from '../../shared/api/http';
import styles from './tasks.module.css';

type Preview = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'error' };

export function TaskResult({ url, title }: { url: string; title: string }) {
  const { expireIdentity } = useIdentity();
  const [preview, setPreview] = useState<Preview>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    async function load() {
      try {
        const response = await fetch(url, { signal: controller.signal, credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) throw new RequestError('结果图片加载失败', response.status, 'RESULT_READ_ERROR');
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        if (!blob.type.startsWith('image/')) throw new Error('Invalid image response');
        objectUrl = URL.createObjectURL(blob);
        setPreview({ status: 'ready', url: objectUrl });
      } catch (error) {
        if (controller.signal.aborted || isAbort(error)) return;
        if (error instanceof RequestError && error.status === 401) expireIdentity();
        else setPreview({ status: 'error' });
      }
    }
    load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, attempt, expireIdentity]);
  if (preview.status === 'loading') return <p role="status">正在加载结果图片…</p>;
  if (preview.status === 'error') return (
    <div className={styles.resultError}>
      <p role="alert">结果图片加载失败，任务仍已成功。</p>
      <button type="button" onClick={() => {
        setPreview({ status: 'loading' });
        setAttempt((value) => value + 1);
      }}>重新加载图片</button>
    </div>
  );
  return <Image className={styles.result} src={preview.url} width={800} height={1000} unoptimized
    alt={`${title}制作结果`} onError={() => setPreview({ status: 'error' })} />;
}
