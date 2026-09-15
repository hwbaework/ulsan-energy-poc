import { apiClient } from '@/api/client';

export async function downloadPdf(url: string, fallbackFilename: string) {
  const response: any = await apiClient.get(url, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const blobUrl = window.URL.createObjectURL(blob);

  const disposition = response.headers?.['content-disposition'];
  let filename = fallbackFilename;
  if (disposition) {
    const match = disposition.match(/filename\*?=(?:UTF-8'')?(.+)/i);
    if (match) filename = decodeURIComponent(match[1].replace(/['"]/g, ''));
  }

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}
