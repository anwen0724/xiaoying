import type { Submission, TaskReceipt } from './types';
import styles from './creation.module.css';

const statusLabels: Record<TaskReceipt['status'], string> = {
  QUEUED: '排队中',
  RUNNING: '执行中',
  SUCCEEDED: '已完成',
  FAILED: '失败',
};

export function SubmissionFeedback({ submission }: { submission: Submission }) {
  if (submission.status === 'failed') {
    return (
      <div className={styles.feedback} role="alert">
        <p className={styles.error}>{submission.message}</p>
        {submission.uncertain && <p>提交结果未确认，任务可能已创建。不会自动重发；再次创建可能产生重复任务。</p>}
      </div>
    );
  }
  if (submission.status !== 'accepted') return null;
  const { task } = submission;
  return (
    <section className={styles.feedback} aria-label="提交回执" aria-live="polite">
      <h3>{task.status === 'FAILED' ? '任务已登记，受理时出现失败' : '任务已受理'}</h3>
      <dl className={styles.receipt}>
        <dt>任务 ID</dt>
        <dd aria-label="任务 ID" className={styles.taskId}>{task.id}</dd>
        <dt>模板</dt>
        <dd>{task.templateTitle}</dd>
        <dt>受理时状态</dt>
        <dd>{statusLabels[task.status]}</dd>
      </dl>
      {task.failure && <p className={styles.error}>{task.failure.message}</p>}
      <p>这是本次提交的受理快照，不代表任务当前状态。后续进度和结果暂不提供。</p>
    </section>
  );
}
