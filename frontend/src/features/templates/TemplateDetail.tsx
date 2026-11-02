import Image from 'next/image';
import Link from 'next/link';
import { errorMessage, RequestError } from '../../shared/api/http';
import { ReadError } from '../../shared/ui/ReadError';
import { CreationForm } from '../creation/CreationForm';
import { TaskScope } from '../tasks/TaskScope';
import { TaskHistory } from '../tasks/TaskHistory';
import { getTemplate } from './api';
import styles from './catalog.module.css';

export async function TemplateDetail({ id }: { id: string }) {
  const loaded = await getTemplate(id).then(
    (template) => ({ ok: true as const, template }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  if (!loaded.ok) {
    return (
      <>
        <Link className="back-link" href="/">← 返回模板库</Link>
        {loaded.error instanceof RequestError && loaded.error.status === 404 ? (
          <section className="panel">
            <h1>模板不存在</h1>
            <p className="subtitle">请返回模板库重新选择。</p>
          </section>
        ) : <ReadError title="模板暂时无法加载" message={errorMessage(loaded.error)} />}
      </>
    );
  }
  const template = loaded.template;
  return (
    <>
      <TaskScope templateId={template.id}>
        <div className="creation-layout">
          <div className="creation-input panel">
            <div className={styles.detailHeading}>
              <Link href="/" aria-label="返回模板库">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
              </Link>
              <h1>{template.title}</h1>
            </div>
            <section className={styles.summary} aria-label="模板说明">
              <Image className={styles.sample} src={template.coverUrl} alt={`${template.title}模拟样例`}
                width={800} height={1000} unoptimized priority />
              <div className={styles.requirements}>
                <p className={styles.description}>{template.description}</p>
                <div className={styles.format} id={`${template.id}-requirements`}>
                  <span>需要 {template.requiredImageCount} 张图片</span>
                  <span>{template.acceptedMimeTypes.map((mime) => mime.replace('image/', '').toUpperCase()).join(' / ')}</span>
                  <span>每张不超过 {template.maxFileSizeBytes / 1024 / 1024} MiB</span>
                </div>
              </div>
            </section>
            <CreationForm key={template.id} template={template} />
          </div>
          <TaskHistory />
        </div>
      </TaskScope>
    </>
  );
}
