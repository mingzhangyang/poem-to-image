import { useCallback, useEffect, useRef } from 'react';
import { createAsyncIntentGate } from '../asyncIntentGate';
import { logError } from '../logger';
import type { AiProvider, BackgroundType, TranslateFn } from '../types';

export const MAX_AI_PROMPT_LENGTH = 500;

interface UseAiBackgroundParams {
  text: string;
  aiProvider: AiProvider;
  aiPrompt: string;
  canvasWidth: number;
  canvasHeight: number;
  accountId: string | null;
  t: TranslateFn;
  getToken?: () => Promise<string | null>;
  setAiError: (value: string) => void;
  setIsGeneratingAI: (value: boolean) => void;
  applyBackgroundImage: (
    source: Blob | string, origin?: 'upload' | 'ai', isCurrent?: () => boolean,
  ) => Promise<boolean>;
  setBackgroundType: (value: BackgroundType) => void;
  onBalanceChange?: (newBalance: number) => void;
}

function resolveAspectRatio(canvasWidth: number, canvasHeight: number) {
  const ratio = canvasWidth / canvasHeight;
  if (ratio > 1.5) return '16:9';
  if (ratio > 1.1) return '4:3';
  if (ratio < 0.6) return '9:16';
  if (ratio < 0.9) return '3:4';
  return '1:1';
}

function clampPrompt(value: string) {
  return value.trim().slice(0, MAX_AI_PROMPT_LENGTH);
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface AiBackgroundResponse {
  error?: string;
  code?: string;
  imageDataUrl?: string;
  creditsCharged?: number;
  balance?: number | null;
  required?: number;
}

export function useAiBackground({
  text,
  aiProvider,
  aiPrompt,
  canvasWidth,
  canvasHeight,
  accountId,
  t,
  getToken,
  setAiError,
  setIsGeneratingAI,
  applyBackgroundImage,
  setBackgroundType,
  onBalanceChange,
}: UseAiBackgroundParams) {
  const gateRef = useRef(createAsyncIntentGate());
  const activeEpochRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const identityRef = useRef(accountId);
  identityRef.current = accountId;

  // Invalidating background intent does not cancel an already-reserved server
  // generation (which may be billed). Its eventual result simply cannot
  // alter the user's latest canvas choice.
  const invalidate = useCallback(() => {
    gateRef.current.invalidate();
    activeEpochRef.current = null;
    if (mountedRef.current) {
      setIsGeneratingAI(false);
      setAiError('');
    }
  }, [setIsGeneratingAI, setAiError]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      gateRef.current.invalidate();
      activeEpochRef.current = null;
    };
  }, []);

  useEffect(() => {
    // Sign-in, sign-out and account switches invalidate in-flight requests.
    invalidate();
  }, [accountId, invalidate]);

  const generate = useCallback(async () => {
    // A synchronous guard prevents double-clicks from double-charging.
    if (activeEpochRef.current !== null) return;
    if (!accountId) {
      setAiError(t('errSignInRequired'));
      return;
    }
    if (!text && !aiPrompt) {
      setAiError(t('errNoPrompt'));
      return;
    }

    const epoch = gateRef.current.begin();
    activeEpochRef.current = epoch;
    const isCurrent = () => mountedRef.current
      && identityRef.current === accountId && gateRef.current.isCurrent(epoch);

    setIsGeneratingAI(true);
    setAiError('');

    try {
      const prompt = clampPrompt(
        aiPrompt ||
          `A beautiful, atmospheric, and minimalist background image suitable for a poem. The poem is: "${text}". The image should have plenty of empty space for text, and match the mood of the poem. No text in the image.`,
      );

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = await getToken?.();
      if (!isCurrent()) return;
      if (!token) throw new Error(t('errSignInRequired'));
      headers.Authorization = `Bearer ${token}`;

      const response = await fetch('/api/ai-background', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          requestId: createRequestId(),
          provider: aiProvider,
          prompt,
          aspectRatio: resolveAspectRatio(canvasWidth, canvasHeight),
        }),
      });
      const payload = (await response.json()) as AiBackgroundResponse;

      // A superseded background may still have consumed credits. Refresh the
      // authoritative balance for the *same* account, regardless of whether
      // the returned image is still wanted.
      if (mountedRef.current && identityRef.current === accountId
        && typeof payload.balance === 'number' && onBalanceChange) {
        onBalanceChange(payload.balance);
      }

      if (!isCurrent()) return;
      if (!response.ok) {
        if (payload.code === 'INSUFFICIENT_CREDITS') throw new Error(t('errInsufficientCredits'));
        if (payload.code === 'UNAUTHORIZED') throw new Error(t('errSignInRequired'));
        throw new Error(payload.error || t('errGenFailed'));
      }
      if (!payload.imageDataUrl) {
        setAiError(t('errNoImage'));
        return;
      }

      // Image decoding/transcoding is itself async. The final commit must
      // check both this AI epoch and the background image conversion epoch.
      const applied = await applyBackgroundImage(payload.imageDataUrl, 'ai', isCurrent);
      if (applied && isCurrent()) setBackgroundType('ai');
    } catch (error: unknown) {
      if (!isCurrent()) return;
      logError('AI generation error', error);
      setAiError(error instanceof Error ? error.message : t('errGenFailed'));
    } finally {
      if (isCurrent()) {
        activeEpochRef.current = null;
        setIsGeneratingAI(false);
      }
    }
  }, [
    accountId,
    aiProvider,
    aiPrompt,
    canvasHeight,
    canvasWidth,
    getToken,
    onBalanceChange,
    setAiError,
    applyBackgroundImage,
    setBackgroundType,
    setIsGeneratingAI,
    t,
    text,
  ]);

  return { generate, invalidate };
}
