import { useState, useCallback, useEffect, useRef } from 'react';
import { normalizeUserCustomTemplate } from '../poemStyle';
import type { UserCustomTemplate, TemplateBackgroundConfig, TemplateTypographyConfig, TemplateDecorationsConfig } from '../types';

const STORAGE_KEY = 'poem-to-image.custom-templates';

// ── localStorage helpers ─────────────────────────────────────────────────────

function loadFromStorage(): UserCustomTemplate[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Array<UserCustomTemplate | (Omit<UserCustomTemplate, 'poemStyle'> & { poemStyle?: UserCustomTemplate['poemStyle'] })>)
      .map((template) => normalizeUserCustomTemplate(template));
  } catch {
    return [];
  }
}

function saveToStorage(templates: UserCustomTemplate[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch { /* ignore */ }
}

// ── Accent color helper ──────────────────────────────────────────────────────

function deriveAccentColors(background: TemplateBackgroundConfig): { accentFrom: string; accentTo: string } {
  if (background.backgroundType === 'gradient') {
    return { accentFrom: background.gradientColor1, accentTo: background.gradientColor2 };
  }
  return { accentFrom: background.backgroundColor, accentTo: background.backgroundColor };
}

// ── Cloud API helpers ────────────────────────────────────────────────────────

async function apiFetch(path: string, getToken: () => Promise<string | null>, options?: RequestInit): Promise<Response> {
  const token = await getToken();
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
}

async function fetchCloudTemplates(getToken: () => Promise<string | null>): Promise<UserCustomTemplate[]> {
  const res = await apiFetch('/api/templates', getToken);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    templates: Array<UserCustomTemplate | (Omit<UserCustomTemplate, 'poemStyle'> & { poemStyle?: UserCustomTemplate['poemStyle'] })>;
  };
  return (data.templates ?? []).map((template) => normalizeUserCustomTemplate(template));
}

async function postCloudTemplate(
  payload: Omit<UserCustomTemplate, 'id' | 'createdAt'> & { name: string },
  getToken: () => Promise<string | null>,
): Promise<UserCustomTemplate | null> {
  const res = await apiFetch('/api/templates', getToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return (await res.json()) as UserCustomTemplate;
}

async function deleteCloudTemplate(id: string, getToken: () => Promise<string | null>): Promise<boolean> {
  const res = await apiFetch(`/api/templates/${id}`, getToken, { method: 'DELETE' });
  return res.ok;
}

// ── Hook ────────────────────────────────────────────────────────────────────

interface UseCustomTemplatesParams {
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
}

export function useCustomTemplates({ isSignedIn, getToken }: UseCustomTemplatesParams) {
  // Always initialize from localStorage — instant render, no spinner needed.
  // When signed in, cloud data will replace this silently in the background.
  const [customTemplates, setCustomTemplates] = useState<UserCustomTemplate[]>(loadFromStorage);
  const [activeCustomTemplateId, setActiveCustomTemplateId] = useState<string | null>(null);

  // Prevent re-fetching cloud data more than once per session
  const cloudSyncedRef = useRef(false);

  // ── Stale-while-revalidate: background cloud sync on sign-in ──────────────
  useEffect(() => {
    if (!isSignedIn) {
      cloudSyncedRef.current = false;
      return;
    }

    if (cloudSyncedRef.current) return;

    let cancelled = false;

    fetchCloudTemplates(getToken).then((templates) => {
      if (cancelled) return;
      cloudSyncedRef.current = true;
      setCustomTemplates(templates);
      saveToStorage(templates); // keep localStorage as a warm cache
    }).catch(() => { /* silently keep showing stale local data */ });

    return () => { cancelled = true; };
  }, [isSignedIn, getToken]);

  // ── Save template ──────────────────────────────────────────────────────────
  const saveCustomTemplate = useCallback(async (
    name: string,
    background: TemplateBackgroundConfig,
    typography: TemplateTypographyConfig,
    decorations: TemplateDecorationsConfig,
    poemStyle: UserCustomTemplate['poemStyle'],
  ) => {
    const { accentFrom, accentTo } = deriveAccentColors(background);
    const payload = { name: name.trim() || 'Custom Template', accentFrom, accentTo, background, typography, decorations, poemStyle };

    if (isSignedIn) {
      const saved = await postCloudTemplate(payload, getToken);
      if (!saved) return null;
      setCustomTemplates((prev) => {
        const updated = [normalizeUserCustomTemplate(saved), ...prev];
        saveToStorage(updated);
        return updated;
      });
      setActiveCustomTemplateId(saved.id);
      return saved;
    }

    // Guest: localStorage only
    const newTemplate: UserCustomTemplate = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      ...payload,
    };
    setCustomTemplates((prev) => {
      const updated = [normalizeUserCustomTemplate(newTemplate), ...prev];
      saveToStorage(updated);
      return updated;
    });
    setActiveCustomTemplateId(newTemplate.id);
    return normalizeUserCustomTemplate(newTemplate);
  }, [isSignedIn, getToken]);

  // ── Apply template ─────────────────────────────────────────────────────────
  const applyCustomTemplate = useCallback((id: string) => {
    setActiveCustomTemplateId(id);
  }, []);

  // ── Delete template ────────────────────────────────────────────────────────
  const deleteCustomTemplate = useCallback(async (id: string) => {
    if (isSignedIn) {
      await deleteCloudTemplate(id, getToken);
    }
    setCustomTemplates((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      saveToStorage(updated); // update cache regardless of auth state
      return updated;
    });
    setActiveCustomTemplateId((prev) => (prev === id ? null : prev));
  }, [isSignedIn, getToken]);

  // ── Clear active ───────────────────────────────────────────────────────────
  const clearActiveCustomTemplate = useCallback(() => {
    setActiveCustomTemplateId(null);
  }, []);

  return {
    customTemplates,
    activeCustomTemplateId,
    saveCustomTemplate,
    applyCustomTemplate,
    deleteCustomTemplate,
    clearActiveCustomTemplate,
  };
}
