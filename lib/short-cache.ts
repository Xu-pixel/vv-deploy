export function shortCache<T>(ttl: number, limit = 128) {
  const entries = new Map<string, { value: T; expires: number }>();
  return (key: string, load: () => T): T => {
    const hit = entries.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;
    const value = load();
    entries.delete(key);
    if (entries.size >= limit) entries.delete(entries.keys().next().value!);
    const entry = { value, expires: Date.now() + ttl };
    entries.set(key, entry);
    if (value instanceof Promise) value.catch(() => {
      if (entries.get(key) === entry) entries.delete(key);
    });
    return value;
  };
}
