import { useCallback } from 'react';
import type { BackgroundType, TranslateFn } from '../types';

interface UseAiBackgroundParams {
  text: string;
  aiPrompt: string;
  canvasWidth: number;
  canvasHeight: number;
  t: TranslateFn;
  setAiError: (value: string) => void;
  setIsGeneratingAI: (value: boolean) => void;
  setBackgroundImage: (value: string | null) => void;
  setBackgroundType: (value: BackgroundType) => void;
}

function resolveAspectRatio(canvasWidth: number, canvasHeight: number) {
  const ratio = canvasWidth / canvasHeight;

  if (ratio > 1.5) {
    return '16:9';
  }

  if (ratio > 1.1) {
    return '4:3';
  }

  if (ratio < 0.6) {
    return '9:16';
  }

  if (ratio < 0.9) {
    return '3:4';
  }

  return '1:1';
}

export function useAiBackground({
  text,
  aiPrompt,
  canvasWidth,
  canvasHeight,
  t,
  setAiError,
  setIsGeneratingAI,
  setBackgroundImage,
  setBackgroundType,
}: UseAiBackgroundParams) {
  return useCallback(async () => {
    if (!text && !aiPrompt) {
      setAiError(t('errNoPrompt'));
      return;
    }

    setIsGeneratingAI(true);
    setAiError('');

    try {
      const prompt =
        aiPrompt ||
        `A beautiful, atmospheric, and minimalist background image suitable for a poem. The poem is: "${text}". The image should have plenty of empty space for text, and match the mood of the poem. No text in the image.`;

      const response = await fetch('/api/ai-background', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          aspectRatio: resolveAspectRatio(canvasWidth, canvasHeight),
        }),
      });

      const payload = (await response.json()) as { error?: string; imageDataUrl?: string };

      if (!response.ok) {
        throw new Error(payload.error || t('errGenFailed'));
      }

      if (!payload.imageDataUrl) {
        setAiError(t('errNoImage'));
        return;
      }

      setBackgroundImage(payload.imageDataUrl);
      setBackgroundType('ai');
    } catch (error: any) {
      console.error('AI Generation Error:', error);
      setAiError(error.message || t('errGenFailed'));
    } finally {
      setIsGeneratingAI(false);
    }
  }, [
    aiPrompt,
    canvasHeight,
    canvasWidth,
    setAiError,
    setBackgroundImage,
    setBackgroundType,
    setIsGeneratingAI,
    t,
    text,
  ]);
}