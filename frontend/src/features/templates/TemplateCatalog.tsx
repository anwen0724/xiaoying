import Image from 'next/image';
import Link from 'next/link';
import { errorMessage } from '../../shared/api/http';
import { ReadError } from '../../shared/ui/ReadError';
import { listCategories, listTemplates } from './api';
import styles from './catalog.module.css';

export async function TemplateCatalog({ category }: { category?: string }) {
  const [categories, templates] = await Promise.allSettled([listCategories(), listTemplates(category)]);
  return (
    <>
      <div className={styles.catalogHeading}>
        <div>
          <h1>模板库</h1>
        </div>
        {templates.status === 'fulfilled' && <p className={styles.count}>{templates.value.length} 个模板</p>}
      </div>
      {categories.status === 'fulfilled' ? (
        <nav className={styles.filters} aria-label="模板分类">
          <Link href="/" aria-current={category === undefined ? 'page' : undefined}>全部模板</Link>
          {categories.value.map((item) => (
            <Link key={item.code} href={`/?category=${encodeURIComponent(item.code)}`}
              aria-current={category === item.code ? 'page' : undefined}>{item.name}</Link>
          ))}
        </nav>
      ) : <ReadError title="分类暂时无法加载" message={errorMessage(categories.reason)} />}
      {templates.status === 'rejected' ? (
        <ReadError title="模板暂时无法加载" message={errorMessage(templates.reason)} />
      ) : (
        <div className="catalog-grid">
          {templates.value.map((template, index) => (
            <Link className={styles.card} key={template.id} href={`/templates/${encodeURIComponent(template.id)}`}>
              <Image className={styles.cover} src={template.coverUrl} alt="" width={800} height={1000}
                unoptimized loading={index === 0 ? 'eager' : 'lazy'} />
              <div className={styles.cardHeader}>
                <h2>{template.title}</h2>
                <p>{template.categoryName} · {template.requiredImageCount} 张图片</p>
              </div>
            </Link>
          ))}
          {templates.value.length === 0 && (
            <section className={`panel ${styles.empty}`}>
              <h2>这个分类还没有模板</h2>
              <p className="subtitle">选择其他分类，或返回全部模板。</p>
              <Link className="back-link" href="/">查看全部模板</Link>
            </section>
          )}
        </div>
      )}
      <p className="page-footer">演示模板使用预置结果，不对上传图片进行真实合成。</p>
    </>
  );
}
