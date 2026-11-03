import { MaterialHistory } from '../../features/tasks/MaterialHistory';

export default async function HistoryPage({ searchParams }: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const query = await searchParams;
  const category = typeof query.category === 'string' ? query.category : undefined;
  return <MaterialHistory category={category} />;
}
