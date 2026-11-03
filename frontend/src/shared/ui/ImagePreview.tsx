'use client';

import Image from 'next/image';
import { useRef } from 'react';
import styles from './image-preview.module.css';

type Props = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className: string;
  onError?: () => void;
};

export function ImagePreview({ src, alt, width, height, className, onError }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={`${styles.trigger} ${className}`}
        aria-label={`放大查看${alt}`} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        <Image className={styles.thumbnail} src={src} alt={alt} width={width} height={height}
          unoptimized onError={onError} />
      </button>
      <dialog ref={dialog} className={styles.dialog} aria-label={alt} onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close();
      }}>
        <div className={styles.content}>
          <div className={styles.heading}>
            <h2>{alt}</h2>
            <button type="button" aria-label="关闭预览" onClick={() => dialog.current?.close()} autoFocus>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <Image className={styles.fullImage} src={src} alt={alt} width={width} height={height} unoptimized />
        </div>
      </dialog>
    </>
  );
}
