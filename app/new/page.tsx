import { AdminBar } from "@/components/admin-bar";
import { NewProjectForm } from "@/components/new-project-form";
import { requireAdmin } from "@/lib/auth";
import { listCredentials } from "@/lib/db/credentials";
import Link from "next/link";

export default async function NewProjectPage() {
  await requireAdmin();
  const credentials = listCredentials();

  return (
    <div className="flex flex-1 flex-col">
      <AdminBar />
      <main className="mx-auto w-full max-w-xl px-6 pb-20 md:px-10">
        <h1 className="text-2xl tracking-tight">接入仓库</h1>
        <p className="mt-2 text-sm leading-7 text-[var(--mute)]">
          使用 SSH 地址，克隆到 REPOS_DIR。仓库需包含{" "}
          <span className="font-mono">docker-compose.deploy.yaml</span>
          。完成后把维护者链接
          <span className="font-mono"> /app/&lt;id&gt;</span>
          {" "}发给开发者。
        </p>

        {credentials.length === 0 ? (
          <p className="mt-10 text-sm text-[var(--mute)]">
            先到 <Link href="/settings" className="underline">设置</Link> 生成一把 Git 密钥。
          </p>
        ) : (
          <NewProjectForm
            credentials={credentials.map((cred) => ({ id: cred.id, name: cred.name }))}
          />
        )}
      </main>
    </div>
  );
}
