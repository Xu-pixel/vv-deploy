import { expect, test } from "bun:test";
import { shortCache } from "./short-cache";
test("deduplicates in-flight work and retries failures", async () => {
 const cache = shortCache<Promise<number>>(1000); let calls = 0;
 const load = () => { calls++; return Promise.resolve(42); };
 const first = cache("a", load); expect(cache("a", load)).toBe(first);
 expect(await first).toBe(42); expect(calls).toBe(1);
 await expect(cache("b", () => Promise.reject(new Error("offline")))).rejects.toThrow("offline");
 expect(await cache("b", load)).toBe(42); expect(calls).toBe(2);
});
test("expires entries and bounds storage", async () => {
 const cache = shortCache<number>(10, 2);
 expect(cache("a", () => 1)).toBe(1);
 expect(cache("a", () => 2)).toBe(1);
 await Bun.sleep(20); expect(cache("a", () => 3)).toBe(3);
 cache("b", () => 4); cache("c", () => 5);
 expect(cache("a", () => 6)).toBe(6);
});
