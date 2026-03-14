import type { ApiResponse, DocumentItem, QaResult } from '../types';

const BASE = '/api';

async function request<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE}${url}`, init);

  let json: ApiResponse<T>;
  try {
    json = await res.json();
  } catch {
    throw new Error(`请求失败（HTTP ${res.status}）`);
  }

  if (!json.success) {
    throw new Error(json.message || '请求失败');
  }
  return json;
}

export async function fetchDocuments(): Promise<DocumentItem[]> {
  const res = await request<DocumentItem[]>('/admin/documents');
  return res.data ?? [];
}

export async function uploadDocument(file: File): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  await request('/admin/documents', { method: 'POST', body: formData });
}

export async function deleteDocument(docId: string): Promise<void> {
  await request(`/admin/documents/${docId}`, { method: 'DELETE' });
}

export async function askQuestion(question: string): Promise<QaResult> {
  const res = await request<QaResult>('/qa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  return res.data!;
}
