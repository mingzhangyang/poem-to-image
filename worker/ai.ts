import { GoogleGenAI } from '@google/genai';

export type AiProvider = 'gemini' | 'openai';

export const CREDIT_COST: Record<AiProvider, number> = {
  gemini: 1,
  openai: 3,
};

export function normalizeProvider(provider?: string): AiProvider {
  return provider === 'openai' ? 'openai' : 'gemini';
}

function resolveOpenAiSize(aspectRatio?: string): string {
  if (aspectRatio === '16:9' || aspectRatio === '4:3') return '1536x1024';
  if (aspectRatio === '9:16' || aspectRatio === '3:4') return '1024x1536';
  return '1024x1024';
}

interface GenerateResult {
  imageDataUrl: string;
}

interface OpenAiImageResponse {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
}

function badGenResult(message: string): never {
  throw new Error(message);
}

export async function generateWithGemini(
  prompt: string,
  aspectRatio: string,
  geminiApiKey: string,
): Promise<GenerateResult> {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: { aspectRatio, imageSize: '1K' },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (!part.inlineData?.data || !part.inlineData.mimeType) continue;
    return { imageDataUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` };
  }

  badGenResult('The model did not return an image.');
}

export async function generateWithOpenAi(
  prompt: string,
  aspectRatio: string,
  openAiApiKey: string,
): Promise<GenerateResult> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: resolveOpenAiSize(aspectRatio),
      quality: 'medium',
    }),
  });

  let payload: OpenAiImageResponse | null = null;
  try {
    payload = (await response.json()) as OpenAiImageResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    badGenResult(payload?.error?.message || 'Failed to generate AI background.');
  }

  const imageBase64 = payload?.data?.[0]?.b64_json;
  if (!imageBase64) {
    badGenResult('The model did not return an image.');
  }

  return { imageDataUrl: `data:image/png;base64,${imageBase64}` };
}
