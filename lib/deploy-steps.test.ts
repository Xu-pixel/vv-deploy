import { expect, test } from "bun:test";
import { deployStep } from "./deploy-steps";

test("real progress maps to stages without inventing completed work", () => {
  expect(deployStep("building", 2)).toBe(0);
  expect(deployStep("building", 12)).toBe(1);
  expect(deployStep("building", 15)).toBe(2);
  expect(deployStep("building", 99)).toBe(2);
  expect(deployStep("running", null)).toBe(3);
  expect(deployStep("error", 12)).toBe(1);
  expect(deployStep("error", null)).toBe(-1);
  expect(deployStep("stopped", 100)).toBe(-1);
  expect(deployStep("idle", 100)).toBe(-1);
});
