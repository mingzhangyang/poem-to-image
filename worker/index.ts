import { GoogleGenAI } from '@google/genai';

interface Env {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ASSETS: {
    fetch(input: Request | string, init?: RequestInit): Promise<Response>;
  };
}

type AiProvider = 'gemini' | 'openai';
const MAX_AI_PROMPT_LENGTH = 500;

interface GenerateImageRequest {
  prompt?: string;
  aspectRatio?: string;
  provider?: AiProvider;
}

interface OpenAiImageResponse {
  data?: Array<{
    b64_json?: string;
  }>;
  error?: {
    message?: string;
  };
}

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

function badRequest(message: string, status = 400) {
  return json({ error: message }, { status });
}

function normalizeProvider(provider?: string): AiProvider {
  return provider === 'openai' ? 'openai' : 'gemini';
}

function resolveOpenAiSize(aspectRatio?: string) {
  if (aspectRatio === '16:9' || aspectRatio === '4:3') {
    return '1536x1024';
  }

  if (aspectRatio === '9:16' || aspectRatio === '3:4') {
    return '1024x1536';
  }

  return '1024x1024';
}

async function generateWithGemini(prompt: string, aspectRatio: string, env: Env) {
  if (!env.GEMINI_API_KEY) {
    return badRequest('Missing GEMINI_API_KEY Worker secret.', 500);
  }

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio,
          imageSize: '1K',
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (!part.inlineData?.data || !part.inlineData.mimeType) {
        continue;
      }

      return json({
        imageDataUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
      });
    }

    return badRequest('The model did not return an image.', 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate AI background.';
    return badRequest(message, 502);
  }
}

async function generateWithOpenAi(prompt: string, aspectRatio: string, env: Env) {
  if (!env.OPENAI_API_KEY) {
    return badRequest('Missing OPENAI_API_KEY Worker secret.', 500);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
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
      return badRequest(payload?.error?.message || 'Failed to generate AI background.', 502);
    }

    const imageBase64 = payload?.data?.[0]?.b64_json;

    if (!imageBase64) {
      return badRequest('The model did not return an image.', 502);
    }

    return json({
      imageDataUrl: `data:image/png;base64,${imageBase64}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate AI background.';
    return badRequest(message, 502);
  }
}

async function handleGenerateAiBackground(request: Request, env: Env) {
  let payload: GenerateImageRequest;

  try {
    payload = (await request.json()) as GenerateImageRequest;
  } catch {
    return badRequest('Request body must be valid JSON.');
  }

  if (!payload.prompt?.trim()) {
    return badRequest('Prompt is required.');
  }

  if (payload.prompt.trim().length > MAX_AI_PROMPT_LENGTH) {
    return badRequest(`Prompt must be ${MAX_AI_PROMPT_LENGTH} characters or fewer.`);
  }

  const prompt = payload.prompt.trim();
  const aspectRatio = payload.aspectRatio || '1:1';
  const provider = normalizeProvider(payload.provider);

  if (provider === 'openai') {
    return generateWithOpenAi(prompt, aspectRatio, env);
  }

  return generateWithGemini(prompt, aspectRatio, env);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/ai-background') {
      if (request.method !== 'POST') {
        return badRequest('Method not allowed.', 405);
      }

      return handleGenerateAiBackground(request, env);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies { fetch(request: Request, env: Env): Promise<Response> | Response };