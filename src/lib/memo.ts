/**
 * Cache en memoria por instancia con TTL. Suficiente para un dashboard
 * personal: evita golpear las APIs de Google en recargas seguidas sin
 * meter datos de request dentro de `unstable_cache`.
 */
const store = new Map<string, { at: number; value: unknown }>();

export async function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await fn();
  store.set(key, { at: Date.now(), value });
  return value;
}

export function invalidate(prefix: string): void {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
