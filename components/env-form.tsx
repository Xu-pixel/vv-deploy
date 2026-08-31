"use client";

import { useRef, useState } from "react";
import { CheckIcon, CopyIcon, FileUpIcon } from "lucide-react";
import { saveProjectEnvAction } from "@/app/actions/projects";
import { ActionForm } from "@/components/action-form";
import { copyText } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { toastError } from "@/components/error-toast";

export function EnvForm({
  id,
  initialText,
  busy,
}: {
  id: string;
  initialText: string;
  busy: boolean;
}) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  return (
    <ActionForm action={saveProjectEnvAction} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <Textarea
        ref={textRef}
        name="env_text"
        defaultValue={initialText}
        placeholder={"DATABASE_URL=postgres://…\nTOKEN="}
        spellCheck={false}
        disabled={busy}
        rows={10}
        className="field-sizing-fixed min-h-48 max-h-[28rem] resize-y overflow-auto font-mono text-sm"
      />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            accept=".env,.txt,text/plain"
            className="hidden"
            tabIndex={-1}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file || !textRef.current) return;
              try {
                const text = (await file.text()).replace(/^\uFEFF/, "");
                textRef.current.value = text.endsWith("\n") || text === "" ? text : `${text}\n`;
                toast.add({ type: "success", title: `已导入 ${file.name}` });
              } catch {
                toastError("读取文件失败");
              }
            }}
          />
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <FileUpIcon />
            导入 .env
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              const text = textRef.current?.value ?? "";
              if (!text.trim()) {
                toastError("还没有可复制的内容");
                return;
              }
              try {
                await copyText(text);
              } catch {
                toastError("复制失败");
                return;
              }
              setCopied(true);
              toast.add({ type: "success", title: "已复制 .env 文本" });
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "已复制" : "复制"}
          </Button>
        </div>
        <Button type="submit" disabled={busy}>
          保存
        </Button>
      </div>
    </ActionForm>
  );
}
