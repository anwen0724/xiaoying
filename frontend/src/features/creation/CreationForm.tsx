'use client';

import { useIdentity } from '../identity/IdentityProvider';
import type { Template } from '../templates/types';
import { UploadField } from './UploadField';
import { useUploads } from './useUploads';
import { useSubmission } from './useSubmission';
import { SubmissionFeedback } from './SubmissionFeedback';
import { useTasks } from '../tasks/TaskScope';
import styles from './creation.module.css';

export function CreationForm({ template }: { template: Template }) {
  const identity = useIdentity();
  const user = identity.session.status === 'ready' ? identity.session.user : null;
  return <ScopedForm key={`${template.id}:${identity.generation}`} template={template}
    canWrite={user !== null} onUnauthorized={identity.expireIdentity} />;
}

function ScopedForm({ template, canWrite, onUnauthorized }: {
  template: Template;
  canWrite: boolean;
  onUnauthorized: () => void;
}) {
  const { slots, choose, remove } = useUploads(template, onUnauthorized);
  const { accepted } = useTasks();
  const { submission, submit, clear } = useSubmission(template.id, onUnauthorized, accepted);
  const pending = submission.status === 'submitting';
  const readyCount = slots.filter((slot) => slot.status === 'ready').length;
  const canSubmit = canWrite && !pending && readyCount === template.requiredImageCount;
  const submitLabel = pending ? '正在提交…'
    : submission.status === 'accepted' ? '再次制作'
    : submission.status === 'failed' && submission.uncertain ? '再次创建（可能重复）' : '开始制作';
  return (
    <section className="panel" aria-label="制作区域">
      <div className={styles.formHeading}>
        <h2>上传图片</h2>
        <span>{readyCount} / {template.requiredImageCount} 已准备</span>
      </div>
      <p className={styles.description}>图片顺序对应模板中的位置，可在提交前替换。</p>
      {!canWrite && <p className={styles.identityHint}>请先在页顶选择并确认演示身份。</p>}
      <form onSubmit={async (event) => {
        event.preventDefault();
        if (!canSubmit) return;
        const assetIds = slots.flatMap((slot) => slot.status === 'ready' ? [slot.asset.id] : []);
        await submit(assetIds);
      }}>
        <div className={styles.slots}>
          {slots.map((slot, index) => (
            <UploadField key={slot.id} slot={slot} position={index + 1}
              accept={template.acceptedMimeTypes.join(',')} disabled={!canWrite || pending}
              onChoose={async (file) => { if (canWrite && clear()) await choose(slot.id, file); }}
              onRemove={() => { if (canWrite && clear()) remove(slot.id); }} />
          ))}
        </div>
        <div className={styles.submitArea}>
          <button className={styles.primary} type="submit" disabled={!canSubmit}>{submitLabel}</button>
          <p role="status">{pending ? '正在确认受理结果，请勿重复提交。'
            : canSubmit ? '素材已准备好，可以提交制作。' : `请先完成 ${template.requiredImageCount} 张图片的上传。`}</p>
        </div>
      </form>
      <SubmissionFeedback submission={submission} />
    </section>
  );
}
