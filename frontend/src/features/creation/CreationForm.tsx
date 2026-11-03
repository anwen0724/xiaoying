'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useIdentity } from '../identity/IdentityProvider';
import type { Template } from '../templates/types';
import { UploadField } from './UploadField';
import { useUploads } from './useUploads';
import { useSubmission } from './useSubmission';
import { SubmissionFeedback } from './SubmissionFeedback';
import { useTasks } from '../tasks/TaskScope';
import styles from './creation.module.css';

export function CreationForm({ template, children }: { template: Template; children: ReactNode }) {
  const identity = useIdentity();
  const user = identity.session.status === 'ready' ? identity.session.user : null;
  return <ScopedForm key={`${template.id}:${identity.generation}`} template={template}
    canWrite={user !== null} identityReady={identity.session.status === 'ready'} onUnauthorized={identity.expireIdentity}>
    {children}
  </ScopedForm>;
}

function ScopedForm({ template, canWrite, identityReady, onUnauthorized, children }: {
  template: Template;
  canWrite: boolean;
  identityReady: boolean;
  onUnauthorized: () => void;
  children: ReactNode;
}) {
  const identityPrompt = useRef<HTMLDialogElement>(null);
  const addInput = useRef<HTMLInputElement>(null);
  const focusAddition = useRef(false);
  const [selectionError, setSelectionError] = useState('');
  const { slots, choose, remove } = useUploads(template, onUnauthorized);
  const { accepted } = useTasks();
  const { submission, submit, clear } = useSubmission(template.id, onUnauthorized, accepted);
  const pending = submission.status === 'submitting';
  const emptySlots = slots.filter((slot) => slot.status === 'empty');
  const selectedCount = slots.length - emptySlots.length;
  const nextPosition = slots.findIndex((slot) => slot.status === 'empty') + 1;
  const readyCount = slots.filter((slot) => slot.status === 'ready').length;
  const canSubmit = canWrite && !pending && readyCount === template.requiredImageCount;
  const submitLabel = pending ? '正在提交…'
    : submission.status === 'accepted' ? '再次制作'
    : submission.status === 'failed' && submission.uncertain ? '再次创建（可能重复）' : '开始制作';
  useEffect(() => {
    if (focusAddition.current) {
      addInput.current?.focus();
      focusAddition.current = false;
    }
  }, [slots]);

  async function addFiles(files: File[]) {
    if (!canWrite || files.length === 0 || !clear()) return;
    if (files.length > emptySlots.length) {
      setSelectionError(`最多还能添加 ${emptySlots.length} 张图片，请重新选择。`);
      return;
    }
    setSelectionError('');
    await Promise.all(files.map((file, index) => choose(emptySlots[index].id, file)));
  }

  return (
    <section className={styles.form} aria-label="制作区域">
      <form className={styles.creationForm} onSubmit={async (event) => {
        event.preventDefault();
        if (!canSubmit) return;
        const assetIds = slots.flatMap((slot) => slot.status === 'ready' ? [slot.asset.id] : []);
        await submit(assetIds);
      }}>
        <div className={styles.creationScroll} role="region" aria-label="模板与上传内容" tabIndex={0}>
          {children}
          <div>
            <div className={styles.formHeading}>
              <h2>上传图片</h2>
              <span>已选 {selectedCount} / {template.requiredImageCount} 张</span>
            </div>
            {template.requiredImageCount > 1 && <p className={styles.description}>图片按编号对应模板位置，支持一次多选。</p>}
            <div className={`${styles.slots} ${selectedCount === 0 ? styles.emptyGrid : ''}`}>
              {slots.map((slot, index) => slot.status === 'empty' ? null : (
                <UploadField key={slot.id} slot={slot} position={index + 1}
                  requirementsId={`${template.id}-requirements`}
                  accept={template.acceptedMimeTypes.join(',')} disabled={!identityReady || pending}
                  onChoose={async (file) => { if (canWrite && clear()) await choose(slot.id, file); }}
                  onRemove={() => {
                    if (canWrite && clear()) {
                      focusAddition.current = true;
                      setSelectionError('');
                      remove(slot.id);
                    }
                  }} />
              ))}
              {emptySlots.length > 0 && (
                <fieldset className={`${styles.addSlot} ${selectedCount === 0 ? styles.emptyUpload : ''}`}
                  disabled={!identityReady || pending}>
                  <legend className={styles.slotLegend}>图片 {nextPosition}</legend>
                  <label className={styles.addLabel}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span>{selectedCount === 0 ? '选择图片' : '添加图片'}</span>
                    {selectedCount === 0 && <span className={styles.slotStatus}>尚未上传</span>}
                    <input ref={addInput} type="file" multiple={template.requiredImageCount > 1}
                      accept={template.acceptedMimeTypes.join(',')} aria-label={`图片 ${nextPosition}`}
                      aria-describedby={`${template.id}-requirements${selectionError ? ` ${template.id}-selection-error` : ''}`}
                      onClick={(event) => {
                        if (!canWrite) {
                          event.preventDefault();
                          identityPrompt.current?.showModal();
                        }
                      }}
                      onChange={async (event) => {
                        const files = Array.from(event.target.files ?? []);
                        event.target.value = '';
                        await addFiles(files);
                      }} />
                  </label>
                </fieldset>
              )}
            </div>
            {selectionError && <p className={styles.error} id={`${template.id}-selection-error`} role="alert">{selectionError}</p>}
          </div>
          <SubmissionFeedback submission={submission} />
        </div>
        <div className={styles.submitArea}>
          <p role="status">{readyCount} / {template.requiredImageCount} 已准备</p>
          <button className={styles.primary} type="submit" disabled={!canSubmit}>{submitLabel}</button>
          {pending && <p role="status">正在确认受理结果，请勿重复提交。</p>}
        </div>
      </form>
      <dialog ref={identityPrompt} className={styles.identityPrompt} aria-label="请先选择身份">
        <h2>请先选择身份</h2>
        <div className={styles.promptActions}>
          <button type="button" onClick={() => identityPrompt.current?.close()}>取消</button>
          <button type="button" className={styles.promptPrimary} onClick={() => {
            identityPrompt.current?.close();
            document.getElementById('demo-identity')?.focus();
          }}>去选择身份</button>
        </div>
      </dialog>
    </section>
  );
}
