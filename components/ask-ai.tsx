"use client";

import { FishIcon, MoonIcon, SparklesIcon } from "lucide-react";
import { copyText } from "@/components/copy-button";
import { toastError } from "@/components/error-toast";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export function buildAskPrompt(opts: {
  name: string;
  gitUrl: string;
  branch: string;
  error: string;
}): string {
  const error = opts.error.trim().slice(-6000);
  return [
    "请帮我排查 Docker Compose 部署失败的原因，并给出可执行的修复步骤。",
    "",
    `项目：${opts.name}`,
    `仓库：${opts.gitUrl}`,
    `分支：${opts.branch}`,
    "",
    "报错：",
    error,
  ].join("\n");
}

const PLATFORMS = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    Icon: SparklesIcon,
    href: (q: string) => `https://chatgpt.com/?q=${q}`,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    Icon: FishIcon,
    href: (q: string) => `https://chat.deepseek.com/?q=${q}`,
  },
  {
    id: "kimi",
    name: "Kimi",
    Icon: MoonIcon,
    href: (q: string) => `https://www.kimi.com/?q=${q}`,
  },
] as const;

export function AskAiButtons({ prompt }: { prompt: string }) {
  return (
    <div className="deploy-pill-ask">
      {PLATFORMS.map((platform) => (
        <Button
          key={platform.id}
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-[#e8eaee] hover:bg-white/12 hover:text-white"
          title={`复制报错并在 ${platform.name} 中查询`}
          aria-label={`复制报错并在 ${platform.name} 中查询`}
          onClick={async (event) => {
            event.preventDefault();
            event.stopPropagation();
            try {
              await copyText(prompt);
            } catch {
              toastError("复制失败，仍会打开对话");
            }
            const q = encodeURIComponent(prompt.slice(0, 1500));
            window.open(platform.href(q), "_blank", "noopener,noreferrer");
            toast.add({
              type: "success",
              title: `已复制，正在打开 ${platform.name}`,
            });
          }}
        >
          <platform.Icon />
        </Button>
      ))}
    </div>
  );
}
