import { items, localUrl, positiveInteger, record, requestJson, text, RequestError } from '../../shared/api/http';
import type { Category, Template } from './types';

function parseTemplate(value: unknown): Template {
  const template = record(value);
  if (!Array.isArray(template.acceptedMimeTypes)) {
    throw new RequestError('模板的文件类型要求无效。', 502, 'INVALID_RESPONSE');
  }
  return {
    id: text(template.id),
    title: text(template.title),
    category: text(template.category),
    categoryName: text(template.categoryName),
    description: text(template.description),
    coverUrl: localUrl(template.coverUrl),
    requiredImageCount: positiveInteger(template.requiredImageCount),
    acceptedMimeTypes: template.acceptedMimeTypes.map(text),
    maxFileSizeBytes: positiveInteger(template.maxFileSizeBytes),
  };
}

export async function listTemplates(category?: string): Promise<Template[]> {
  const query = category === undefined ? '' : `?category=${encodeURIComponent(category)}`;
  return items(await requestJson(`/api/templates${query}`), parseTemplate);
}

export async function listCategories(): Promise<Category[]> {
  return items(await requestJson('/api/categories'), (value) => {
    const category = record(value);
    return { code: text(category.code), name: text(category.name) };
  });
}

export async function getTemplate(id: string): Promise<Template> {
  return parseTemplate(await requestJson(`/api/templates/${encodeURIComponent(id)}`));
}
