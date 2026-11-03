'use client';

import { useRef } from 'react';
import { ImagePreview } from '../../shared/ui/ImagePreview';
import type { UploadSlot } from './types';
import styles from './creation.module.css';

type Props = {
  slot: Exclude<UploadSlot, { status: 'empty' }>;
  position: number;
  accept: string;
  requirementsId: string;
  disabled: boolean;
  onChoose: (file: File) => Promise<void>;
  onRemove: () => void;
};

export function UploadField({ slot, position, accept, requirementsId, disabled, onChoose, onRemove }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const errorId = `${slot.id}-error`;
  return (
    <fieldset className={styles.slot} disabled={disabled}>
      <legend className={styles.slotLegend}>图片 {position}</legend>
      {slot.preview ? (
        <ImagePreview key={slot.preview} className={styles.preview} src={slot.preview} width={120} height={120}
          alt={`图片 ${position} 预览`} />
      ) : <div className={styles.unavailablePreview}>无法预览</div>}
      <div className={styles.slotHeading}>
        <span>图片 {position}</span>
        <span className={styles.slotStatus} role="status">
          {slot.status === 'uploading' && '正在上传…'}
          {slot.status === 'ready' && '上传成功'}
          {slot.status === 'failed' && '上传失败'}
        </span>
      </div>
      <span className={styles.filename} title={slot.file.name}>{slot.file.name}</span>
      <div className={styles.slotActions}>
        <label className={styles.fileLabel}>
          替换图片
          <input ref={input} type="file" accept={accept} aria-label={`图片 ${position}`}
            aria-invalid={slot.status === 'failed' ? true : undefined}
            aria-describedby={slot.status === 'failed' ? `${requirementsId} ${errorId}` : requirementsId}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) await onChoose(file);
            }} />
        </label>
        <button type="button" aria-label={`移除图片 ${position}`} onClick={onRemove}>移除</button>
      </div>
      {slot.status === 'failed' && (
        <>
          <p className={styles.error} role="alert" id={errorId}>{slot.message}</p>
          {slot.retryable && <button className={styles.retryUpload} type="button" onClick={async () => {
            input.current?.focus();
            await onChoose(slot.file);
          }}>重试上传图片 {position}</button>}
        </>
      )}
    </fieldset>
  );
}
