import { expect, test } from "bun:test";
import { TERM_COLS, TERM_ROWS, TermScreen } from "./term-screen";

test("carriage return refreshes the same row", () => {
  const term = new TermScreen(4, 40);
  term.write("=> #1 foo\r");
  term.write("=> #1 foo 2s\r");
  expect(term.visible()).toBe("=> #1 foo 2s\n");
  expect(term.write("")).toBe("");
});

test("cursor up rewrites a line instead of appending", () => {
  const term = new TermScreen(4, 40);
  term.write("line1\nline2\n");
  expect(term.write("\u001b[1Arefresh\n")).toBe("");
  expect(term.visible()).toBe("line1\nrefresh\n");
});

test("lines that scroll past the fixed height are emitted once", () => {
  const term = new TermScreen(2, 20);
  const scrolled = term.write("one\ntwo\nthree\n");
  expect(scrolled).toBe("one\ntwo\n");
  expect(term.visible()).toBe("three\n");
});

test("pty size constants stay in a small range", () => {
  expect(TERM_ROWS).toBeGreaterThanOrEqual(12);
  expect(TERM_ROWS).toBeLessThanOrEqual(24);
  expect(TERM_COLS).toBe(100);
});
