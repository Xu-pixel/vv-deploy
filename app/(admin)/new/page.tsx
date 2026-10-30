import { NewProjectIntro } from "@/components/new-intro";
import { NewProjectForm } from "@/components/new-project-form";
import { requireAdmin } from "@/lib/auth";
import { listCredentials } from "@/lib/db/credentials";
import Link from "next/link";

export default async function NewProjectPage() {
  await requireAdmin();
  const credentials = listCredentials();

  return (
      <main className="mx-auto w-full max-w-xl px-6 pb-20 md:px-10">
        <NewProjectIntro />

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
  );
}
