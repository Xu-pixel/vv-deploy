# vv-deploy

小公司持续部署面板：用 SSH 拉取 Gitee / GitHub 仓库，改写 Compose 后 `docker compose --build` 启动，并按仓库名挂到 Traefik（`<仓库>.你的域名`）。

只有一名管理员能看到全部项目。每个项目有一个 256 位随机 id，拿到 `/app/<id>` 的人可以管理该项目。

第一版只支持手动「拉取并部署」，没有 webhook。

## 本机开发

需要 [Bun](https://bun.sh) 1.4+、Git、Docker。应用必须用 Bun 运行（SQLite 走 `bun:sqlite`）。

```bash
bun install
bun run migrate
bun run dev
```

打开 [http://localhost:3000](http://localhost:3000)。第一次会进入 `/setup`，展示 Admin 密钥。保存后再去登录。

## 用 Docker 启动

```bash
chmod +x scripts/start.sh
./scripts/start.sh
```

脚本会：

1. 建好 `data` / `repos` / `volumes` / `overrides` / `secrets`
2. 把仓库根目录误建成的 `config.json` 目录清掉（若有），并把旧的根目录配置迁到 `data/config.json`
3. 按当前用户的 uid/gid 跑容器，并把 docker.sock 的组加进去，这样 bind 目录可写、也能调 Docker
4. 检测是否已有 Traefik 容器或 `traefik` 网络：有则复用，没有则一并拉起
5. 跑 migrate 容器（建表并写出 Traefik 静态配置），成功后删掉
6. 启动面板（默认 `:3000`）

可选环境变量：

- `HOST_ROOT`：宿主机上本仓库的绝对路径（生成的 compose 卷路径用它；脚本默认是当前目录）
- `TRAEFIK_NETWORK`：默认 `traefik`
- `VV_HOST`：让面板自己也走 Traefik，例如 `deploy.example.com`
- `VV_UID` / `VV_GID` / `DOCKER_GID`：一般不用设，`start.sh` 会按当前用户和 docker.sock 填好

## 管理员忘记密钥

密钥的哈希在 `data/config.json` 的 `adminKeyHash`。不要手改哈希，用脚本重置：

```bash
bun run reset-admin
```

它会写入新的哈希，把明文写到 `data/.bootstrap-key`，并打印到终端。然后打开 `/setup` 或用新密钥登录。

## 使用顺序

1. 登录管理员
2. 设置里填写域名后缀（一行一个，第一个为默认），并生成一把 Git SSH 密钥
3. 把公钥加到 Gitee / GitHub（部署公钥或帐号 SSH 密钥）
4. DNS 把 `*.example.com` 指到这台机器。自动 HTTPS：设置里打开 Let's Encrypt 并填邮箱，再到项目页勾选 HTTPS。每个打开的项目单独申请（HTTP-01，不用 DNS API）。保存后重新 `./scripts/start.sh`，已部署项目再点一次「拉取并部署」
5. 「接入」里填 SSH 地址，克隆完成后把 `/app/<id>` 发给维护者
6. 项目页可填环境变量（写入每个 Compose 服务，并用于 `${NAME}` 替换）；保存后重新「拉取并部署」才进容器
7. 维护者点「拉取并部署」

代码在 `repos/<slug>`，数据卷在 `volumes/<slug>`。面板不会改仓库里的原 compose，改写结果写在 `overrides/<slug>/docker-compose.yml`。

未规范的卷路径会被收到 `volumes/<slug>` 下；入口 Host 一律改成 `<slug>.<所选域名后缀>`；宿主机端口映射会去掉，避免抢端口。

## 目录

| 路径 | 用途 |
| --- | --- |
| `data/config.json` | Admin 密钥哈希、域名后缀、Traefik 网络名、Let's Encrypt |
| `data/vv.sqlite` | SQLite |
| `repos/` | 克隆的代码 |
| `volumes/` | 集中数据卷 |
| `overrides/` | 生成的 compose |
| `secrets/` | Git 私钥 |
| `data/traefik/` | Traefik 静态配置与 ACME 环境变量 |
| `data/letsencrypt/acme.json` | Let's Encrypt 证书存储 |

## Let's Encrypt

每个项目按主机名申请一张证书（`shop.example.com`），走 HTTP-01，只要填邮箱。`sslip.io` / `localhost` 不会申请。机器的 80 端口必须能被 Let's Encrypt 访问。

本机自带 Traefik 时，migrate 会按 `data/config.json` 写出静态配置并重建 Traefik。若复用已有 Traefik，对方必须已有名为 `letsencrypt` 的 HTTP-01 resolver；我们只给项目打 labels。
