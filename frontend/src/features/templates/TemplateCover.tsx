'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import styles from './template-cover.module.css';

type Props = {
  src: string;
  title: string;
  alt: string;
  className: string;
  priority?: boolean;
};

export function TemplateCover({ src, title, alt, className, priority = false }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const imageUrl = attempt === 0 ? src : `${src}${src.includes('?') ? '&' : '?'}coverRetry=${attempt}`;

  function retry() {
    if (status !== 'failed') return;
    frame.current?.focus({ preventScroll: true });
    setStatus('loading');
    setAttempt((current) => current + 1);
  }

  return (
    <div ref={frame} className={`${styles.frame} ${className}`} role="group"
      aria-label={`${title}封面`} tabIndex={-1}>
      <Image key={attempt} className={styles.image} src={imageUrl} alt={alt} fill unoptimized
        priority={priority} loading={priority || attempt > 0 ? 'eager' : 'lazy'}
        style={{ visibility: status === 'ready' ? 'visible' : 'hidden' }}
        onLoad={() => setStatus('ready')} onError={() => setStatus('failed')} />
      {status !== 'ready' && (
        <div className={styles.feedback}>
          <p role="status">{status === 'failed' ? '封面加载失败' : attempt > 0 ? '正在重新加载…' : '正在加载封面…'}</p>
          {(status === 'failed' || attempt > 0) && (
            <button type="button" aria-label={`重新加载${title}封面`} disabled={status === 'loading'} onClick={retry}>
              重新加载封面
            </button>
          )}
        </div>
      )}
    </div>
  );
}
