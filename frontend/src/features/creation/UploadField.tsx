'use client';

import Image from 'next/image';
import { useRef } from 'react';
import type { UploadSlot } from './types';
import styles from './creation.module.css';

type Props = {
  slot: UploadSlot;
  position: number;
  accept: string;
  requirementsId: string;
  disabled: boolean;
  onChoose: (file: File) => Promise<void>;
  onRemove: () => void;
};

export function UploadField({ slot, position, accept, requirementsId, disabled, onChoose, onRemove }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const preview = slot.status === 'empty' ? null : slot.preview;
  const errorId = `${slot.id}-error`;
  return (
    <fieldset className={styles.slot} disabled={disabled}>
      <legend>图片 {position}</legend>
      <div className={styles.uploadBody}>
        {preview ? (
          <Image className={styles.preview} src={preview} width={120} height={100}
            alt={`图片 ${position} 预览`} unoptimized />
        ) : <span className={styles.emptySlot} aria-hidden="true">＋</span>}
        <div className={styles.fileInfo}>
          <span className={styles.filename}>{slot.status === 'empty' ? '选择一张图片' : slot.file.name}</span>
          <span className={styles.slotStatus} role="status">
            {slot.status === 'empty' && '尚未上传'}
            {slot.status === 'uploading' && '正在上传…'}
            {slot.status === 'ready' && '上传成功'}
            {slot.status === 'failed' && '尚未上传成功'}
          </span>
          <label className={styles.fileLabel}>
            {slot.status === 'empty' ? '选择图片' : '替换图片'}
            <input ref={input} type="file" accept={accept} aria-label={`图片 ${position}`}
              aria-invalid={slot.status === 'failed' ? true : undefined}
              aria-describedby={slot.status === 'failed' ? `${requirementsId} ${errorId}` : requirementsId}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) await onChoose(file);
              }} />
          </label>
        </div>
      </div>
      {slot.status !== 'empty' && (
        <div className={styles.slotActions}>
          {slot.status === 'failed' && slot.retryable && (
            <button type="button" onClick={async () => {
              input.current?.focus();
              await onChoose(slot.file);
            }}>重试上传图片 {position}</button>
          )}
          <button type="button" aria-label={`移除图片 ${position}`} onClick={() => {
            input.current?.focus();
            onRemove();
          }}>移除</button>
        </div>
      )}
      {slot.status === 'failed' && <p className={styles.error} role="alert" id={errorId}>{slot.message}</p>}
    </fieldset>
  );
}
