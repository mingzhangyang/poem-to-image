import { useCallback } from 'react';
import { logError } from '../logger';
import type { AiProvider, BackgroundType, TranslateFn } from '../types';

export const MAX_AI_PROMPT_LENGTH = 500;

interface UseAiBackgroundParams {
  text: string;
  aiProvider: AiProvider;
  aiPrompt: string;
  canvasWidth: number;
  canvasHeight: number;
  t: TranslateFn;
  getToken?: () => Promise<string | null>;
  setAiError: (value: string) => void;
  setIsGeneratingAI: (value: boolean) => void;
  applyBackgroundImage: (value: Blob | string, origin?: 'upload' | 'ai') => Promise<void>;
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
  t,
  getToken,
  setAiError,
  setIsGeneratingAI,
  applyBackgroundImage,
  setBackgroundType,
  onBalanceChange,
}: UseAiBackgroundParams) {
  return useCallback(async () => {
    if (!text && !aiPrompt) {
      setAiError(t('errNoPrompt'));
      return;
    }

    setIsGeneratingAI(true);
    setAiError('');

    try {
      const prompt = clampPrompt(
        aiPrompt ||
          `A beautiful, atmospheric, and minimalist background image suitable for a poem. The poem is: "${text}". The image should have plenty of empty space for text, and match the mood of the poem. No text in the image.`,
      );

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (getToken) {
        const token = await getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }

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

      if (!response.ok) {
        if (payload.code === 'INSUFFICIENT_CREDITS') {
          throw new Error(t('errInsufficientCredits'));
        }
        if (payload.code === 'UNAUTHORIZED') {
          throw new Error(t('errSignInRequired'));
        }
        if (payload.code === 'DUPLICATE_REQUEST') {
          throw new Error(payload.error || t('errGenFailed'));
        }
        throw new Error(payload.error || t('errGenFailed'));
      }

      if (!payload.imageDataUrl) {
        setAiError(t('errNoImage'));
        return;
      }

      await applyBackgroundImage(payload.imageDataUrl, 'ai');
      setBackgroundType('ai');

      if (typeof payload.balance === 'number' && onBalanceChange) {
        onBalanceChange(payload.balance);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('errGenFailed');
      logError('AI generation error', error);
      setAiError(message);
    } finally {
      setIsGeneratingAI(false);
    }
  }, [
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
}
