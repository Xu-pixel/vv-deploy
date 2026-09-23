import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { readDeploySurface } from "./deploy-surface";

const shennong = "/mnt/rs/productive-projects/shennong-agri-agent/docker-compose.deploy.yml";
const lettuce = "/mnt/rs/productive-projects/lettuce/docker-compose.deploy.yml";

test("shennong deploy file: image name, https host, env_file", () => {
  expect(existsSync(shennong)).toBe(true);
  const surface = readDeploySurface(readFileSync(shennong, "utf8"));
  expect(surface.name).toBe("shennong-agri-agent");
  expect(surface.host).toBe("kepu.shennong.cc");
  expect(surface.https).toBe(true);
  expect(surface.envFiles).toEqual([".env.local"]);
});

test("lettuce deploy file: public image and host, no env_file", () => {
  expect(existsSync(lettuce)).toBe(true);
  const surface = readDeploySurface(readFileSync(lettuce, "utf8"));
  expect(surface.name).toBe("lettuce-app");
  expect(surface.host).toBe("lettuce.app.shennong.cc");
  expect(surface.https).toBe(true);
  expect(surface.envFiles).toEqual([]);
});
