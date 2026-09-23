import { AdminBar } from "@/components/admin-bar";
import { ActionForm } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  createCredentialAction,
  deleteCredentialAction,
} from "@/app/actions/settings";
import { requireAdmin } from "@/lib/auth";
import { listCredentials } from "@/lib/db/credentials";

export default async function SettingsPage() {
  await requireAdmin();
  const credentials = listCredentials();

  return (
    <div className="flex flex-1 flex-col">
      <AdminBar />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-16 px-6 pb-20 md:px-10">
        <section>
          <h1 className="text-2xl tracking-tight">Git 凭证</h1>
          <p className="mt-2 text-sm leading-7 text-[var(--mute)]">
            把公钥加到 Gitee / GitHub 的部署密钥或个人 SSH 密钥里，再用 SSH 地址接入仓库。
          </p>
          <ActionForm action={createCredentialAction} className="mt-6 grid gap-3 sm:grid-cols-[1fr_8rem_auto]">
            <Input name="name" placeholder="名称，如 gitee-main" required />
            <NativeSelect name="provider" className="w-full">
              <NativeSelectOption value="gitee">Gitee</NativeSelectOption>
              <NativeSelectOption value="github">GitHub</NativeSelectOption>
              <NativeSelectOption value="other">其他</NativeSelectOption>
            </NativeSelect>
            <Button type="submit">生成密钥</Button>
          </ActionForm>

          <ul className="mt-8 flex flex-col gap-4">
            {credentials.length === 0 ? (
              <li className="text-sm text-[var(--mute)]">还没有凭证。</li>
            ) : (
              credentials.map((cred) => (
                <li key={cred.id} className="card p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p>
                      {cred.name}
                      <span className="ml-2 font-mono text-xs text-[var(--mute)]">
                        {cred.provider}
                      </span>
                    </p>
                    <ActionForm action={deleteCredentialAction}>
                      <input type="hidden" name="id" value={cred.id} />
                      <button type="submit" className="ghost">
                        删除
                      </button>
                    </ActionForm>
                  </div>
                  <pre className="mt-3 overflow-x-auto text-xs leading-6 text-[var(--mute)]">
                    {cred.public_key}
                  </pre>
                  <CopyButton value={cred.public_key} label="复制公钥" />
                </li>
              ))
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}
