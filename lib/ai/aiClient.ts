import "server-only";

import { config } from "@/lib/config";
import { badRequest } from "@/lib/http/errors";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionsResponse = {
  choices?: Array<{
    message?: { role?: string; content?: string | null };
  }>;
  error?: { message?: string };
};

function buildChatCompletionsUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (normalized.endsWith("/chat/completions")) return normalized;
  if (normalized.endsWith("/v1")) return `${normalized}/chat/completions`;
  return `${normalized}/v1/chat/completions`;
}

export async function createChatCompletion(params: {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  if (!config.ai) throw badRequest("AI 未配置（缺少 AI_BASE_URL/AI_API_KEY/AI_MODEL）");
  if (!config.ai.apiKey) throw badRequest("AI 未配置（缺少 AI_API_KEY）");
  if (!config.ai.model) throw badRequest("AI 未配置（缺少 AI_MODEL）");

  const url = buildChatCompletionsUrl(config.ai.baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages: params.messages,
        temperature: params.temperature ?? 0.2,
        max_tokens: params.maxTokens ?? 1200,
      }),
      signal: controller.signal,
    });

    const json = (await res.json().catch(() => null)) as ChatCompletionsResponse | null;
    if (!res.ok) {
      const fallbackMessage =
        (json as unknown as { message?: string; msg?: string; error?: { msg?: string } } | null)?.message ||
        (json as unknown as { message?: string; msg?: string; error?: { msg?: string } } | null)?.msg ||
        (json as unknown as { message?: string; msg?: string; error?: { msg?: string } } | null)?.error?.msg;
      const message = json?.error?.message || fallbackMessage || "AI 请求失败";
      throw badRequest(message);
    }

    const content = json?.choices?.[0]?.message?.content;
    if (!content || !content.trim()) throw badRequest("AI 响应为空");
    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
}
