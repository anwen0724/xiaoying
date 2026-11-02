import { TemplateCatalog } from '../features/templates/TemplateCatalog';

export default async function HomePage({ searchParams }: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const query = await searchParams;
  const category = typeof query.category === 'string' ? query.category : undefined;
  return <TemplateCatalog category={category} />;
}
