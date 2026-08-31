"use client";

import { useState } from "react";
import { createProjectAction, peekRemoteBranchesAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ActionForm } from "./action-form";
import { toastError } from "./error-toast";

type Credential = { id: string; name: string };

export function NewProjectForm({ credentials }: { credentials: Credential[] }) {
  const [branches, setBranches] = useState<string[]>([]);
  const [picked, setPicked] = useState("");
  const [peeking, setPeeking] = useState(false);

  return (
    <ActionForm action={createProjectAction} className="mt-8 flex flex-col gap-3">
      <Input
        name="git_url"
        placeholder="git@gitee.com:org/app.git"
        className="font-mono"
        required
      />
      <NativeSelect name="credential_id" className="w-full" required>
        {credentials.map((cred) => (
          <NativeSelectOption key={cred.id} value={cred.id}>
            {cred.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {branches.length > 0 ? (
        <NativeSelect
          name="branch"
          className="w-full font-mono"
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
        >
          {branches.map((name) => (
            <NativeSelectOption key={name} value={name}>
              {name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : (
        <p className="text-sm text-[var(--mute)]">
          先检索远程分支，或直接接入（默认分支）。本地已有仓库时只拉取，不重新克隆。
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={peeking}
          onClick={async (event) => {
            const form = event.currentTarget.form;
            if (!form) return;
            const data = new FormData(form);
            setPeeking(true);
            const result = await peekRemoteBranchesAction(
              String(data.get("git_url") ?? ""),
              String(data.get("credential_id") ?? ""),
            );
            setPeeking(false);
            if (result.error) {
              toastError(result.error);
              return;
            }
            setBranches(result.branches);
            setPicked(result.defaultBranch ?? result.branches[0] ?? "");
          }}
        >
          {peeking ? "检索中…" : "检索分支"}
        </Button>
        <Button type="submit">克隆</Button>
      </div>
    </ActionForm>
  );
}
