import { redirect } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { isAdmin } from "@/lib/auth";
import { ensureAdminKey, readBootstrapKey, readConfig } from "@/lib/config";

export default async function SetupPage() {
  await ensureAdminKey();
  const key = readBootstrapKey();
  if (!key) {
    if (await isAdmin()) redirect("/");
    if (readConfig().adminKeyHash) redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-6 py-24">
      <p className="text-sm text-[var(--mute)]">第一次启动</p>
      <h1 className="mt-4 text-3xl tracking-tight">保存这把 Admin 密钥</h1>
      <p className="mt-3 text-sm leading-7 text-[var(--mute)]">
        只显示这一次（直到首次登录）。忘记了用仓库里的重置脚本改 config.json。
      </p>
      <pre className="card mt-8 overflow-x-auto p-4 font-mono text-sm">
        {key}
      </pre>
      <div className="mt-4 flex items-center gap-4">
        {key ? <CopyButton value={key} label="复制密钥" /> : null}
        <Button nativeButton={false} render={<a href="/login" />}>
          去登录
        </Button>
      </div>
    </main>
  );
}
