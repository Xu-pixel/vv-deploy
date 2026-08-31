"use client";

import { useState, type ReactNode } from "react";
import { CheckIcon, Link2Icon } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function copyText(value: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    /* HTTP / 部分手机没有 clipboard，走下面 */
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.top = "0";
  input.style.left = "0";
  input.style.width = "2px";
  input.style.height = "2px";
  input.style.padding = "0";
  input.style.border = "none";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.focus();
  input.select();
  input.setSelectionRange(0, value.length);
  const ok = document.execCommand("copy");
  document.body.removeChild(input);
  if (!ok) throw new Error("复制失败");
}

export function CopyButton({
  value,
  label = "复制",
  icon = false,
  className,
  children,
}: {
  value: string;
  label?: string;
  icon?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await copyText(value);
    } catch {
      toast.add({ type: "error", title: "复制失败", description: value });
      return;
    }
    setDone(true);
    toast.add({ type: "success", title: "已复制", description: value });
    setTimeout(() => setDone(false), 1500);
  };

  if (icon) {
    return (
      <Button
        type="button"
        size="icon"
        variant="ghost"
        title={done ? "已复制" : label}
        aria-label={done ? "已复制" : label}
        onClick={copy}
      >
        {done ? <CheckIcon /> : <Link2Icon />}
      </Button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "underline-offset-4 hover:underline",
        !children && "text-xs tracking-wide text-[var(--mute)] hover:text-[var(--ink)]",
        className,
      )}
      title={done ? "已复制" : label}
      onClick={copy}
    >
      {children ?? (done ? "已复制" : label)}
    </button>
  );
}
