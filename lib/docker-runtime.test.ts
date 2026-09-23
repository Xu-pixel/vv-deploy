import { expect, test } from "bun:test";
import { runtimeFromPs } from "./docker";

test("compose ps states map to runtime status", () => {
  expect(runtimeFromPs([])).toEqual({ status: "idle", containers: [] });
  expect(runtimeFromPs(["shennong-agri-agent-app-1\trunning"])).toEqual({
    status: "running",
    containers: ["shennong-agri-agent-app-1"],
  });
  expect(
    runtimeFromPs(["lettuce-web-1\trunning", "lettuce-collector-1\texited"]),
  ).toEqual({
    status: "running",
    containers: ["lettuce-web-1"],
  });
  expect(runtimeFromPs(["lettuce-web-1\texited"])).toEqual({
    status: "stopped",
    containers: [],
  });
});
