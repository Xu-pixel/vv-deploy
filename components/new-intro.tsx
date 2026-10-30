export function NewProjectIntro() {
  return <>
        <h1 className="text-2xl tracking-tight">接入仓库</h1>
        <p className="mt-2 text-sm leading-7 text-[var(--mute)]">
          使用 SSH 地址，克隆到 REPOS_DIR。仓库需包含{" "}
          <span className="font-mono">docker-compose.deploy.yaml</span>
          。完成后把维护者链接
          <span className="font-mono"> /app/&lt;id&gt;</span>
          {" "}发给开发者。
        </p>
  </>;
}
