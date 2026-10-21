import { describe, expect, it } from "vitest";
import { SearchCache } from "../server/search-cache";
import { webResult } from "./web-fixtures";

describe("private bounded search cache", () => {
  it("expires cached output at the TTL and does not refresh age on reads", () => {
    const cache = new SearchCache(1000);
    cache.put("guest-a", webResult, 0);
    expect(cache.get("guest-a", 999)?.expires).toBe(1000);
    expect(cache.get("guest-b", 999)).toBeUndefined();
    expect(cache.get("guest-a", 1000)).toBeUndefined();
  });
  it("evicts the least recently used entry and respects disabled/byte limits", () => {
    const cache = new SearchCache(1000, 2);
    cache.put("a", webResult, 0);
    cache.put("b", webResult, 0);
    cache.get("a", 1);
    cache.put("c", webResult, 2);
    expect(cache.get("b", 2)).toBeUndefined();
    expect(cache.get("a", 2)).toBeDefined();
    const disabled = new SearchCache(0);
    disabled.put("a", webResult);
    expect(disabled.get("a")).toBeUndefined();
    const tiny = new SearchCache(1000, 20, 1);
    tiny.put("a", webResult);
    expect(tiny.get("a")).toBeUndefined();
  });
});
