import { GoogleGenAI } from '@google/genai';

interface Env {
  GEMINI_API_KEY: string;
  ASSETS: {
    fetch(input: Request | string, init?: RequestInit): Promise<Response>;
  };
}

interface GenerateImageRequest {
  prompt?: string;
  aspectRatio?: string;
}

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

function badRequest(message: string, status = 400) {
  return json({ error: message }, { status });
}

async function handleGenerateAiBackground(request: Request, env: Env) {
  if (!env.GEMINI_API_KEY) {
    return badRequest('Missing GEMINI_API_KEY Worker secret.', 500);
  }

  let payload: GenerateImageRequest;

  try {
    payload = (await request.json()) as GenerateImageRequest;
  } catch {
    return badRequest('Request body must be valid JSON.');
  }

  if (!payload.prompt?.trim()) {
    return badRequest('Prompt is required.');
  }

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [{ text: payload.prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: payload.aspectRatio || '1:1',
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