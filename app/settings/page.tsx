import { AdminBar } from "@/components/admin-bar";
import { ActionForm } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  createCredentialAction,
  deleteCredentialAction,
  saveDomainAction,
} from "@/app/actions/settings";
import { requireAdmin } from "@/lib/auth";
import { readConfig } from "@/lib/config";
import { listCredentials } from "@/lib/db/credentials";
import { isLetsEncryptSuffix } from "@/lib/letsencrypt";

export default async function SettingsPage() {
  await requireAdmin();
  const config = readConfig();
  const credentials = listCredentials();
  const sampleHost = `my-app.${config.domainSuffixes.find(isLetsEncryptSuffix) ?? "example.com"}`;

  return (
    <div className="flex flex-1 flex-col">
      <AdminBar />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-16 px-6 pb-20 md:px-10">
        <section>
          <h1 className="text-2xl tracking-tight">域名</h1>
          <p className="mt-2 text-sm leading-7 text-[var(--mute)]">
            一行一个后缀，第一个为默认。项目会把{" "}
            <span className="font-mono">DOMAIN=仓库名.后缀</span>
            {" "}写入仓库目录的 .env，例如 my-app.example.com。请把
            <span className="font-mono">
              {" "}
              *.{config.domainSuffixes[0] || "example.com"}{" "}
            </span>
            等通配指到这台机器。反向代理写在各仓库的{" "}
            <span className="font-mono">docker-compose.deploy.yaml</span>
            ，面板不再改写 compose。
          </p>
          <ActionForm
            key={[
              config.domainSuffixes.join("\n"),
              config.traefikNetwork,
              config.letsEncryptEnabled ? "1" : "0",
              config.letsEncryptEmail,
            ].join("|")}
            action={saveDomainAction}
            className="mt-6 flex flex-col gap-3"
          >
            <Textarea
              name="domainSuffixes"
              defaultValue={config.domainSuffixes.join("\n")}
              placeholder={"example.com\n127.0.0.1.sslip.io"}
              rows={4}
              className="font-mono"
            />
            <Input
              name="traefikNetwork"
              defaultValue={config.traefikNetwork}
              placeholder="traefik"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="letsEncryptEnabled"
                value="1"
                defaultChecked={config.letsEncryptEnabled}
              />
              自动申请 Let's Encrypt（certresolver 名 letsencrypt，如 {sampleHost}）
            </label>
            <Input
              name="letsEncryptEmail"
              type="email"
              defaultValue={config.letsEncryptEmail}
              placeholder="证书通知邮箱"
            />
            <p className="text-xs leading-6 text-[var(--mute)]">
              按主机名走 HTTP-01。项目 compose 里自行引用{" "}
              <span className="font-mono">certresolver=letsencrypt</span>
              。80 端口要对公网开放。保存后重新 ./scripts/start.sh。
            </p>
            <Button type="submit" className="self-end">
              保存
            </Button>
          </ActionForm>
        </section>

        <section>
          <h2 className="text-2xl tracking-tight">Git 凭证</h2>
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
