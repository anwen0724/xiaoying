import type { Submission } from './types';
import styles from './creation.module.css';

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
  return (
    <section className={styles.feedback} aria-label="提交回执" aria-live="polite">
      <h3>任务已登记</h3>
      <dl className={styles.receipt}>
        <dt>任务 ID</dt>
        <dd aria-label="任务 ID" className={styles.taskId}>{submission.taskId}</dd>
      </dl>
      <p>进度与结果请查看制作记录，可以继续创建下一个任务。</p>
    </section>
  );
}
