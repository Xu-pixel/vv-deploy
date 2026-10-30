export function SettingsIntro() {
  return <>
          <h1 className="text-2xl tracking-tight">Git 凭证</h1>
          <p className="mt-2 text-sm leading-7 text-[var(--mute)]">
            把公钥加到 Gitee / GitHub 的部署密钥或个人 SSH 密钥里，再用 SSH 地址接入仓库。
          </p>
  </>;
}
