import { parseCloudTemplateList, parseTemplateList } from './customTemplateCache';
import type { UserCustomTemplate } from './types';

type GetToken = () => Promise<string | null>;

export interface TemplateRequestOwner {
  getToken: GetToken;
  isCurrent: () => boolean;
  signal: AbortSignal;
}

async function request(
  path: string,
  owner: TemplateRequestOwner,
  options: RequestInit = {},
): Promise<Response> {
  const token = await owner.getToken();
  // In particular, don't dispatch an authenticated mutation with a new
  // account's token after the user switches accounts during getToken().
  if (!owner.isCurrent() || owner.signal.aborted) throw new Error('STALE_TEMPLATE_SCOPE');
  if (!token) throw new Error('TEMPLATE_AUTH_UNAVAILABLE');

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(path, {
    ...options,
    signal: owner.signal,
    headers,
  });
  if (!response.ok) throw new Error(`TEMPLATE_HTTP_${response.status}`);
  if (!owner.isCurrent() || owner.signal.aborted) throw new Error('STALE_TEMPLATE_SCOPE');
  return response;
}

export async function fetchCloudTemplates(owner: TemplateRequestOwner): Promise<UserCustomTemplate[]> {
  const res = await request('/api/templates', owner, { method: 'GET', cache: 'no-store' });
  const payload: unknown = await res.json();
  if (!owner.isCurrent()) throw new Error('STALE_TEMPLATE_SCOPE');
  // HTTP 200 with { templates: [] } is a valid empty account. Any non-2xx or
  // malformed response is a failure, never interpreted as empty.
  return parseCloudTemplateList(payload);
}

export async function createCloudTemplate(
  payload: Omit<UserCustomTemplate, 'id' | 'createdAt'>,
  owner: TemplateRequestOwner,
): Promise<UserCustomTemplate> {
  const res = await request('/api/templates', owner, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const response: unknown = await res.json();
  if (!owner.isCurrent()) throw new Error('STALE_TEMPLATE_SCOPE');
  return parseTemplateList([response])[0];
}

export async function renameCloudTemplate(
  id: string,
  name: string,
  owner: TemplateRequestOwner,
): Promise<void> {
  await request(`/api/templates/${encodeURIComponent(id)}`, owner, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export async function deleteCloudTemplate(id: string, owner: TemplateRequestOwner): Promise<void> {
  await request(`/api/templates/${encodeURIComponent(id)}`, owner, {
    method: 'DELETE',
  });
}
