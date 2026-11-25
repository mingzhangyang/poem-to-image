import type { Page } from '@playwright/test';

export async function readDraft(page: Page) {
  return page.evaluate(async () => new Promise<{
    revision: number;
    scene: { poem: { title: string }; background: { backgroundImage: string | null; backgroundType: string }; decorations: { logos: Array<{ imageUrl: string }> } };
  } | null>((resolve, reject) => {
    const open = indexedDB.open('inkpoem-editor-drafts', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('documents', 'readonly');
      const request = tx.objectStore('documents').get('current');
      request.onsuccess = () => resolve(request.result ?? null);
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => db.close();
    };
  }));
}
