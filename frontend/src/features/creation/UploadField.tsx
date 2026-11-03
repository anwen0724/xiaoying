'use client';

import { useRef } from 'react';
import { ImagePreview } from '../../shared/ui/ImagePreview';
import type { UploadSlot } from './types';
import styles from './creation.module.css';

type Props = {
  slot: UploadSlot;
  position: number;
  accept: string;
  requirementsId: string;
  disabled: boolean;
  onRequestIdentity?: () => void;
  onChoose: (file: File) => Promise<void>;
  onRemove: () => void;
};

export function UploadField({ slot, position, accept, requirementsId, disabled, onRequestIdentity, onChoose, onRemove }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const preview = slot.status === 'empty' ? null : slot.preview;
  const errorId = `${slot.id}-error`;
  return (
    <fieldset className={`${styles.slot} ${slot.status === 'empty' ? styles.emptyUpload : ''}`} disabled={disabled}>
      <legend>图片 {position}</legend>
      <div className={`${styles.uploadBody} ${slot.status === 'empty' ? styles.emptyBody : ''}`}>
        {preview ? (
          <ImagePreview key={preview} className={styles.preview} src={preview} width={120} height={100}
            alt={`图片 ${position} 预览`} />
        ) : <span className={styles.emptySlot} aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m4 17 5-5 4 4 3-3 5 5M15 7h4m-2-2v4" /></svg>
        </span>}
        <div className={styles.fileInfo}>
          {slot.status !== 'empty' && <span className={styles.filename}>{slot.file.name}</span>}
          <span className={styles.slotStatus} role="status">
            {slot.status === 'empty' && '尚未上传'}
            {slot.status === 'uploading' && '正在上传…'}
            {slot.status === 'ready' && '上传成功'}
            {slot.status === 'failed' && '尚未上传成功'}
          </span>
          <div className={styles.slotActions}>
            <label className={styles.fileLabel}>
              {slot.status === 'empty' ? '选择图片' : '替换图片'}
              <input ref={input} type="file" accept={accept} aria-label={`图片 ${position}`}
                onClick={(event) => {
                  if (onRequestIdentity) {
                    event.preventDefault();
                    onRequestIdentity();
                  }
                }}
                aria-invalid={slot.status === 'failed' ? true : undefined}
                aria-describedby={slot.status === 'failed' ? `${requirementsId} ${errorId}` : requirementsId}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) await onChoose(file);
                }} />
            </label>
            {slot.status !== 'empty' && (
              <button type="button" aria-label={`移除图片 ${position}`} onClick={() => {
                input.current?.focus();
                onRemove();
              }}>移除</button>
            )}
            {slot.status === 'failed' && slot.retryable && (
              <button type="button" onClick={async () => {
                input.current?.focus();
                await onChoose(slot.file);
              }}>重试上传图片 {position}</button>
            )}
          </div>
        </div>
      </div>
      {slot.status === 'failed' && <p className={styles.error} role="alert" id={errorId}>{slot.message}</p>}
    </fieldset>
  );
}
