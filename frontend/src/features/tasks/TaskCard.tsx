import type { TaskEntry } from './task-cache';
import { stageLabels, statusLabels } from './types';
import styles from './tasks.module.css';
import { TaskResult } from './TaskResult';

export function TaskCard({ entry }: { entry: TaskEntry }) {
  const { task } = entry;
  return (
    <article className={styles.card} aria-label={`任务 ${task.id}`}>
      <div className={styles.cardHeading}>
        <h3>{task.templateTitle}</h3>
        <span className={styles.status} data-status={task.status}>{statusLabels[task.status]}</span>
      </div>
      <p className={styles.stage}>{task.stage ? stageLabels[task.stage] : task.status === 'FAILED' ? '尚未开始执行' : '等待后台开始'}</p>
      {task.failure && <p className={styles.error}>{task.failure.message}</p>}
      {task.status === 'SUCCEEDED' && task.resultUrl && <TaskResult key={task.resultUrl} url={task.resultUrl} title={task.templateTitle} />}
      <time dateTime={task.createdAt}>{new Date(task.createdAt).toLocaleString('zh-CN', { hour12: false })}</time>
      <p className={styles.taskId} aria-label="任务 ID">{task.id}</p>
      <p>上次确认：<time dateTime={entry.checkedAt}>{new Date(entry.checkedAt).toLocaleTimeString('zh-CN', { hour12: false })}</time></p>
    </article>
  );
}
