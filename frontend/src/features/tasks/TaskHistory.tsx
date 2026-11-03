'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useTasks } from './TaskScope';
import { TaskCard } from './TaskCard';
import styles from './tasks.module.css';

export function TaskHistory({ children }: { children?: React.ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const region = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const { cache, templateId, category, authenticated, controller } = useTasks();
  const { cursor, read } = cache.history;
  useEffect(() => {
    if (!authenticated || !cursor || read.status !== 'idle' || !end.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void controller.loadHistory(true);
    }, { root: templateId ? content.current : null });
    observer.observe(end.current);
    return () => observer.disconnect();
  }, [authenticated, controller, cursor, read.status, templateId]);
  const title = templateId ? '历史素材' : '我的素材';
  const ids = [...new Set([...cache.history.ids, ...cache.pinnedIds])];
  const missing = Object.entries(cache.missing).filter(([, value]) => !templateId || value.templateId === templateId);
  const entries = ids.flatMap((id) => cache.entries[id] ? [cache.entries[id]] : [])
    .filter(({ task }) => !templateId || task.templateId === templateId)
    .sort((left, right) => right.task.createdAt.localeCompare(left.task.createdAt) || right.task.id.localeCompare(left.task.id));
  const isEmpty = entries.length === 0 && missing.length === 0 && cache.history.loaded
    && cache.history.read.status === 'idle' && cache.activeRead.status === 'idle';
  function retry(action: () => void) {
    (heading.current ?? region.current)?.focus();
    action();
  }
  return (
    <section ref={region} tabIndex={-1} className={`panel ${styles.history} ${templateId ? styles.templateHistory : ''}`} aria-label={title}>
      <div className={styles.historyHeading}>
        {templateId ? <h2 ref={heading} tabIndex={-1}>{title}</h2> : children}
        {authenticated && <button type="button" disabled={cache.history.read.status === 'loading' && !cache.history.loadingMore}
          onClick={() => controller.refresh()}>刷新记录</button>}
      </div>
      <div ref={content} className={templateId ? styles.historyContent : undefined}
        role={templateId ? 'region' : undefined} aria-label={templateId ? '本模板记录列表' : undefined}
        tabIndex={templateId ? 0 : undefined}>
        {!authenticated ? <p className={styles.notice}>选择演示身份后查看个人记录。</p> : <>
          {cache.anomaly && <p role="alert" className={styles.error}>{cache.anomaly}</p>}
          {read.status === 'loading' && !cache.history.loadingMore &&
            <p role="status" className={styles.notice}>正在读取制作记录…</p>}
          {cache.history.read.status === 'error' && <div className={styles.notice} role="alert">
            <p>记录暂时无法加载。{cache.history.read.message}</p>
            <button type="button" onClick={() => retry(() => controller.loadHistory(false))}>重新加载记录</button>
          </div>}
          {cache.activeRead.status === 'loading' && <p role="status" className={styles.notice}>正在恢复未完成任务…</p>}
          {cache.activeRead.status === 'error' && <div className={styles.notice} role="alert">
            <p>未完成任务恢复不完整。{cache.activeRead.message}</p>
            <button type="button" onClick={() => retry(() => controller.loadActive())}>重试恢复未完成任务</button>
          </div>}
          {cache.tracking.status === 'error' && <div className={styles.notice} role="alert">
            <p>状态暂时无法更新，已暂停自动查询。{cache.tracking.message}</p>
            <button type="button" onClick={() => retry(() => controller.resume())}>恢复查询</button>
          </div>}
          {entries.length > 0 && <div className={styles.grid}>
            {entries.map((entry) => <TaskCard key={entry.task.id} entry={entry} />)}
          </div>}
          {missing.map(([id]) => (
            <p key={id} className={styles.notice} role="status">记录不可访问：{id}</p>
          ))}
          {isEmpty && (category !== undefined
            ? <p className={styles.notice}>这个分类还没有制作记录。</p>
            : <p className={styles.notice}>还没有制作记录，<Link href="/">选择模板开始创作</Link>。</p>)}
          {read.status === 'loading' && cache.history.loadingMore &&
            <p role="status" className={styles.notice}>正在加载更多记录…</p>}
          {cursor && <div ref={end} className={styles.scrollEnd} aria-hidden="true" />}
        </>}
      </div>
    </section>
  );
}
