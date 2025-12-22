import "server-only";

import { cookies } from "next/headers";

const cacheByCookieStore = new WeakMap<object, Map<string, unknown>>();

async function getCookieStoreKey(): Promise<object> {
  const store = await cookies();
  return store as unknown as object;
}

export async function requestCached<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const cookieKey = await getCookieStoreKey();
  const map = cacheByCookieStore.get(cookieKey) ?? new Map<string, unknown>();
  if (!cacheByCookieStore.has(cookieKey)) cacheByCookieStore.set(cookieKey, map);

  const cached = map.get(key) as Promise<T> | undefined;
  if (cached) return cached;

  const promise = factory();
  map.set(key, promise);
  return promise;
}
