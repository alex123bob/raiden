/**
 * Minimum shape every registry entry must have: a unique string `key` used as
 * its lookup id. Concrete entry types (BulletKind, EnemyType, BossDef, …)
 * extend this with their own behavior/stat fields.
 */
export interface RegistryEntry {
  /** Unique lookup id for this entry within its registry (e.g. 'fighter'). */
  readonly key: string;
}
/**
 * Build a fresh, empty registry keyed by `def.key`. Each registry module
 * creates one via this factory, then its index.ts registers the entries.
 * Returns a small closed-over API over a private Map (insertion-ordered).
 * @typeParam T the concrete entry type stored in this registry.
 */
export function makeRegistry<T extends RegistryEntry>() {
  const map = new Map<string, T>(); // key -> entry; preserves registration order
  return {
    /** Add or replace the entry stored under `def.key`. */
    register(def: T): void { map.set(def.key, def); },
    /** Look up an entry by key, or undefined if none is registered. */
    get(key: string): T | undefined { return map.get(key); },
    /** True if an entry is registered under `key`. */
    has(key: string): boolean { return map.has(key); },
    /** All registered entries, in registration order. */
    all(): T[] { return [...map.values()]; },
  };
}
