import { parse } from "yaml";

export type ComposeFile = {
  services?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

export function parseCompose(text: string): ComposeFile {
  const doc = parse(text);
  if (!doc || typeof doc !== "object") {
    throw new Error("compose 文件不是有效的 YAML 对象");
  }
  return doc as ComposeFile;
}

export function listServices(compose: ComposeFile): string[] {
  return Object.keys(compose.services ?? {});
}
