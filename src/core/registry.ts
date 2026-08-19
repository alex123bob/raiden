export interface RegistryEntry {
  readonly key: string;
}
export function makeRegistry<T extends RegistryEntry>() {
  const map = new Map<string, T>();
  return {
    register(def: T): void { map.set(def.key, def); },
    get(key: string): T | undefined { return map.get(key); },
    has(key: string): boolean { return map.has(key); },
    all(): T[] { return [...map.values()]; },
  };
}
