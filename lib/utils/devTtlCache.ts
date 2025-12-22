import "server-only";

type Entry<T> = {
  value: Promise<T>;
  expiresAt: number;
};

const globalForCache = globalThis as unknown as {
  __devTtlCache?: Map<string, Entry<unknown>>;
};

const cache = globalForCache.__devTtlCache ?? new Map<string, Entry<unknown>>();

if (process.env.NODE_ENV !== "production") {
  globalForCache.__devTtlCache = cache;
}

const MAX_ENTRIES = 500;

function prune(now: number) {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }

  while (cache.size > MAX_ENTRIES) {
    const first = cache.keys().next().value as string | undefined;
    if (!first) return;
    cache.delete(first);
  }
}

export function devTtlCached<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
  if (process.env.NODE_ENV === "production") return factory();

  const now = Date.now();
  const existing = cache.get(key) as Entry<T> | undefined;
  if (existing && existing.expiresAt > now) return existing.value;

  const value = factory();
  cache.set(key, { value, expiresAt: now + Math.max(0, ttlMs) });

  if (cache.size > MAX_ENTRIES) prune(now);
  return value;
}

export function hashCacheKey(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
