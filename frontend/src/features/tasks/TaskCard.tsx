import type { TaskEntry } from './task-cache';
import { stageLabels, statusLabels } from './types';
import styles from './tasks.module.css';
import { TaskResult } from './TaskResult';

export function TaskCard({ entry }: { entry: TaskEntry }) {
  const { task } = entry;
  return (
    <article className={styles.card} aria-label={`任务 ${task.id}`}>
      <div className={styles.media}>
        {task.status === 'SUCCEEDED' && task.resultUrl ? (
          <TaskResult key={task.resultUrl} url={task.resultUrl} title={task.templateTitle} />
        ) : (
          <div className={styles.taskState}>
            <span className={styles.stateMark} data-status={task.status} aria-hidden="true">
              {task.status === 'FAILED' ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 3v1" /></svg>
              ) : <span className={styles.progressMark} />}
            </span>
            <span className={styles.status} data-status={task.status}>{statusLabels[task.status]}</span>
            <p className={styles.stage}>{task.stage ? stageLabels[task.stage] : task.status === 'FAILED' ? '尚未开始执行' : '等待后台开始'}</p>
            {task.failure && <p className={styles.error}>{task.failure.message}</p>}
          </div>
        )}
      </div>
      <div className={styles.cardMeta}>
        <div className={styles.cardHeading}>
          <h3>{task.templateTitle}</h3>
          {task.status === 'SUCCEEDED' && <span className={styles.status} data-status={task.status}>{statusLabels[task.status]}</span>}
        </div>
        <time dateTime={task.createdAt}>{new Date(task.createdAt).toLocaleString('zh-CN', { hour12: false })}</time>
        <details className={styles.taskDetails}>
          <summary>任务详情</summary>
          {task.status === 'SUCCEEDED' && <p>结果整理完成</p>}
          <p className={styles.taskId} aria-label="任务 ID">{task.id}</p>
          <p>上次确认：<time dateTime={entry.checkedAt}>{new Date(entry.checkedAt).toLocaleTimeString('zh-CN', { hour12: false })}</time></p>
        </details>
      </div>
    </article>
  );
}
