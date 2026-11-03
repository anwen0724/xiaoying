import Link from 'next/link';
import { errorMessage } from '../../shared/api/http';
import { ReadError } from '../../shared/ui/ReadError';
import { listCategories, listTemplates } from './api';
import styles from './catalog.module.css';
import { TemplateCover } from './TemplateCover';

export async function TemplateCatalog({ category }: { category?: string }) {
  const [categories, templates] = await Promise.allSettled([listCategories(), listTemplates(category)]);
  return (
    <>
      <div className={styles.catalogHeading}>
        <div>
          <h1 className="collection-title">模板库</h1>
        </div>
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
            <article className={styles.card} key={template.id}>
              <TemplateCover key={template.coverUrl} className={styles.cover} src={template.coverUrl}
                title={template.title} alt="" priority={index === 0} />
              <Link className={styles.cardLink} href={`/templates/${encodeURIComponent(template.id)}`}>
                <div className={styles.cardHeader}>
                  <h2>{template.title}</h2>
                  <p>{template.categoryName} · {template.requiredImageCount} 张图片</p>
                </div>
              </Link>
            </article>
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
    </>
  );
}
