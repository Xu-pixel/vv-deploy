"use client";
import { useEffect, useState } from "react";
import { saveProjectSettingsAction } from "@/app/actions/projects";
import { ActionForm } from "./action-form";
import { Button } from "./ui/button";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { SkeletonSwap } from "./interior/skeleton-swap";
export function ProjectBranches({ id, branch, busy }: { id: string; branch: string; busy: boolean }) {
  const [result, setResult] = useState<{ branches: string[]; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let active = true;
    fetch(`/api/projects/${id}/branches`, { signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { if (active) setResult(data); })
      .catch(() => { if (active) setResult({ branches: [branch], error: "分支加载失败，当前分支仍可使用" }); })
      .finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [id, branch, attempt]);
  return <div className="mt-6">
    <SkeletonSwap ready={result !== null} reserve={64} lines={2} label="加载分支">
      <ActionForm action={saveProjectSettingsAction} className="flex items-end gap-3">
        <input type="hidden" name="id" value={id} />
        <label className="flex min-w-36 flex-1 flex-col gap-1 text-xs text-[var(--mute)]">分支
          <NativeSelect name="branch" defaultValue={branch} className="w-full font-mono" disabled={busy}>
            {(result?.branches ?? [branch]).map(name => <NativeSelectOption key={name} value={name}>{name}</NativeSelectOption>)}
          </NativeSelect>
        </label><Button type="submit" disabled={busy}>保存</Button>
      </ActionForm>
    </SkeletonSwap>
    {result?.error && <p className="text-xs text-[var(--mute)]" role="status">分支加载失败，保留当前分支。<button type="button" className="ml-2 underline" onClick={() => { setResult(null); setAttempt(n => n + 1); }}>重试</button></p>}
  </div>;
}
