/** HTTP and JSON boundary. Feature parsers validate response shapes before rendering. */
export class RequestError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = 'RequestError';
  }
}

export function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RequestError('服务返回的数据格式不正确，请重试。', 502, 'INVALID_RESPONSE');
  }
  return value as Record<string, unknown>;
}

export function text(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new RequestError('服务返回的文本字段无效，请重试。', 502, 'INVALID_RESPONSE');
  }
  return value;
}

export function positiveInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new RequestError('服务返回的数量字段无效，请重试。', 502, 'INVALID_RESPONSE');
  }
  return value;
}

export function localUrl(value: unknown): string {
  const path = text(value);
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    throw new RequestError('服务返回的图片地址无效。', 502, 'INVALID_RESPONSE');
  }
  return path;
}

export function items<T>(value: unknown, parse: (item: unknown) => T): T[] {
  const list = record(value).items;
  if (!Array.isArray(list)) {
    throw new RequestError('服务返回的列表无效，请重试。', 502, 'INVALID_RESPONSE');
  }
  return list.map(parse);
}

export async function requestJson(path: string, options: RequestInit = {}): Promise<unknown> {
  const base = typeof window === 'undefined' ? process.env.JAVA_API_ORIGIN ?? 'http://backend:8080' : '';
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { ...options, cache: 'no-store', credentials: 'same-origin' });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new RequestError('网络连接失败，请检查连接后重试。', 0, 'NETWORK_ERROR');
  }
  if (response.status === 204) return null;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new RequestError('服务响应无法读取，请稍后重试。', response.ok ? 502 : response.status, 'INVALID_RESPONSE');
  }
  if (!response.ok) {
    const error = record(body);
    throw new RequestError(
      typeof error.message === 'string' ? error.message : '请求未完成，请重试。',
      response.status,
      typeof error.code === 'string' ? error.code : 'REQUEST_FAILED',
    );
  }
  return body;
}

export function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function errorMessage(error: unknown): string {
  return error instanceof RequestError ? error.message : '操作暂时无法完成，请重试。';
}
