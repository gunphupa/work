import type { WebSearchResult } from "../src/domain/web-projects";

// Process-local and keyed by a salted session + request hash. A visitor's
// material context/result is never reused for a different browser session.
export class SearchCache {
  private entries = new Map<
    string,
    { value: WebSearchResult; expires: number; bytes: number }
  >();
  constructor(
    private ttlMs = 15 * 60_000,
    private maxEntries = 40,
    private maxBytes = 5_000_000,
  ) {}
  get(key: string, now = Date.now()) {
    this.prune(now);
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return { value: entry.value, expires: entry.expires };
  }
  put(key: string, value: WebSearchResult, now = Date.now()) {
    if (this.ttlMs <= 0) return;
    this.prune(now);
    const bytes = Buffer.byteLength(JSON.stringify(value));
    if (bytes > 250_000 || bytes > this.maxBytes) return;
    this.entries.delete(key);
    this.entries.set(key, { value, bytes, expires: now + this.ttlMs });
    while (
      this.entries.size > this.maxEntries ||
      [...this.entries.values()].reduce((n, e) => n + e.bytes, 0) >
        this.maxBytes
    )
      this.entries.delete(this.entries.keys().next().value!);
  }
  private prune(now: number) {
    for (const [key, value] of this.entries)
      if (value.expires <= now) this.entries.delete(key);
  }
}
