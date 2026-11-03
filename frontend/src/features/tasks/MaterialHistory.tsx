import Link from 'next/link';
import { listCategories } from '../templates/api';
import { errorMessage } from '../../shared/api/http';
import { ReadError } from '../../shared/ui/ReadError';
import { TaskScope } from './TaskScope';
import { TaskHistory } from './TaskHistory';
import styles from './tasks.module.css';

export async function MaterialHistory({ category }: { category?: string }) {
  const [categories] = await Promise.allSettled([listCategories()]);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1 className="collection-title">我的素材</h1>
          <p className="subtitle">查看不同模板的任务、进度与制作结果。</p>
        </div>
      </div>
      <TaskScope category={category}>
        <TaskHistory>
          <div className={styles.filterGroup}>
            <nav className={styles.filters} aria-label="素材分类">
              <Link href="/history" scroll={false} aria-current={category === undefined ? 'page' : undefined}>全部</Link>
              {categories.status === 'fulfilled' && categories.value.map((item) => (
                <Link key={item.code} href={`/history?category=${encodeURIComponent(item.code)}`} scroll={false}
                  aria-current={category === item.code ? 'page' : undefined}>{item.name}</Link>
              ))}
            </nav>
            {categories.status === 'rejected' && <ReadError title="分类暂时无法加载" message={errorMessage(categories.reason)} />}
          </div>
        </TaskHistory>
      </TaskScope>
    </>
  );
}
