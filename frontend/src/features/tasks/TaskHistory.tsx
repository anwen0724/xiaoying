'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { useTasks } from './TaskScope';
import { TaskCard } from './TaskCard';
import styles from './tasks.module.css';

export function TaskHistory() {
  const heading = useRef<HTMLHeadingElement>(null);
  const { cache, templateId, authenticated, controller } = useTasks();
  const title = templateId ? '本模板记录' : '我的记录';
  const ids = [...new Set([...cache.history.ids, ...cache.pinnedIds])];
  const missing = Object.entries(cache.missing).filter(([, value]) => !templateId || value.templateId === templateId);
  const entries = ids.flatMap((id) => cache.entries[id] ? [cache.entries[id]] : [])
    .filter(({ task }) => !templateId || task.templateId === templateId)
    .sort((left, right) => right.task.createdAt.localeCompare(left.task.createdAt) || right.task.id.localeCompare(left.task.id));
  const isEmpty = entries.length === 0 && missing.length === 0 && cache.history.loaded
    && cache.history.read.status === 'idle' && cache.activeRead.status === 'idle';
  function retry(action: () => void) {
    heading.current?.focus();
    action();
  }
  return (
    <section className={`panel ${styles.history}`} aria-label={title}>
      <div className={styles.historyHeading}>
        <h2 ref={heading} tabIndex={-1}>{title}</h2>
        {authenticated && <button type="button" disabled={cache.history.read.status === 'loading' && !cache.history.loadingMore}
          onClick={() => controller.refresh()}>刷新记录</button>}
      </div>
      {templateId && <Link className={styles.allRecords} href="/history">查看全部记录 →</Link>}
      {!authenticated ? <p className={styles.notice}>选择演示身份后查看个人记录。</p> : <>
        {cache.anomaly && <p role="alert" className={styles.error}>{cache.anomaly}</p>}
        {cache.history.read.status === 'loading' && <p role="status" className={styles.notice}>
          {cache.history.loadingMore ? '正在加载更多记录…' : '正在读取制作记录…'}
        </p>}
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
        {isEmpty &&
          <p className={styles.notice}>还没有制作记录，<Link href="/">选择模板开始创作</Link>。</p>}
        {cache.history.cursor && <button className={styles.more} type="button" disabled={cache.history.read.status === 'loading'}
          onClick={() => controller.loadHistory(true)}>加载更多</button>}
      </>}
    </section>
  );
}
