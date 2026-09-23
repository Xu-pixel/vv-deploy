# vv-deploy

小公司持续部署面板：管理员第一次把仓库的 `docker-compose.deploy.yaml` 和反向代理跑通之后，开发者拿着 `/app/<id>` 链接就能 pull、改 `.env`、重新部署、停容器、看容器日志和历次部署记录。

项目列表以 **REPOS_DIR 里的文件夹为准**。进程启动时扫描该目录，给每个子目录补一条 256 bit（32 字节）ID，用 base64url 记在 SQLite 里（避免 `+` `/` `=` 拆坏 URL）。同一文件夹名会沿用已有 ID，不会每次重启换链接。

只有一名管理员（用密钥登录）能检索、接入、看到全部项目。拿到 `/app/<id>` 的人不用账号密码，只能管理这一个项目。

第一版只支持手动「拉取并部署」，没有 webhook。

## 约定

- 所有仓库在宿主机 **同一个目录** `REPOS_DIR`（例如 `/mnt/repos/<slug>`）。面板容器把该路径原样挂进去。
- 部署固定用仓库里的 **`docker-compose.deploy.yaml`**（也认 `.yml`），不再改写 compose。
- 环境变量写在仓库目录的 **`.env`**。compose 里的 `${NAME}` 会从这里替换；容器要读到请在 deploy compose 里加 `env_file: .env`。
- 域名和反向代理写在各仓库的 `docker-compose.deploy.yaml` 里。面板不改域名。
- `git pull` 会保留面板写入的 `.env`。
- 从面板删除项目会停容器并删掉对应文件夹。

## 本机开发

需要 [Bun](https://bun.sh) 1.4+、Git、Docker。应用必须用 Bun 运行（SQLite 走 `bun:sqlite`）。

```bash
bun install
bun run migrate
bun run dev
```

打开 [http://localhost:3000](http://localhost:3000)。第一次会进入 `/setup`，展示 Admin 密钥。保存后再去登录。

本地默认 `REPOS_DIR` 为仓库下的 `repos/`。

## 用 Docker 启动

```bash
chmod +x scripts/start.sh
REPOS_DIR=/mnt/repos ./scripts/start.sh
```

脚本会：

1. 建好 `data` / `secrets`，以及 `REPOS_DIR`（默认本仓库下的 `repos/`）
2. 把仓库根目录误建成的 `config.json` 目录清掉（若有），并把旧的根目录配置迁到 `data/config.json`
3. 按当前用户的 uid/gid 跑容器，并把 docker.sock 的组加进去
4. 检测是否已有 Traefik 容器或 `traefik` 网络：有则复用，没有则一并拉起
5. 跑 migrate 容器，成功后删掉
6. 启动面板（默认 `:3009`）

可选环境变量：

- `REPOS_DIR`：宿主机上放所有项目仓库的绝对路径。容器内必须是同一路径（脚本会按 `${REPOS_DIR}:${REPOS_DIR}` 挂载）
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
2. 设置里生成一把 Git SSH 密钥
3. 把公钥加到 Gitee / GitHub
4. DNS 把应用域名指到这台机器。各仓库的 `docker-compose.deploy.yaml` 自己写 Traefik Host。若用自带 Traefik 并打开 Let's Encrypt，resolver 名是 `letsencrypt`
5. 「接入」里填 SSH 地址，或直接把仓库放到 `REPOS_DIR`；把 `/app/<id>` 发给开发者
6. 开发者可以：改分支、改 `.env`、重新 pull 并部署、停止容器、看容器日志和历次部署记录

`docker-compose.deploy.yaml` 示例（反向代理部分，管理员第一次跑通时写好即可）：

```yaml
services:
  web:
    env_file: .env
    labels:
      - traefik.enable=true
      - traefik.docker.network=traefik
      - traefik.http.routers.${COMPOSE_PROJECT_NAME}.rule=Host(`app.example.com`)
      - traefik.http.routers.${COMPOSE_PROJECT_NAME}.entrypoints=web,websecure
      - traefik.http.routers.${COMPOSE_PROJECT_NAME}.tls.certresolver=letsencrypt
      - traefik.http.services.${COMPOSE_PROJECT_NAME}.loadbalancer.server.port=3000
    networks:
      - default
      - traefik

networks:
  traefik:
    external: true
```

## 目录

| 路径 | 用途 |
| --- | --- |
| `data/config.json` | Admin 密钥哈希、域名后缀、Traefik 网络名、Let's Encrypt |
| `data/vv.sqlite` | SQLite。`deploy_logs` 记录每次部署的时间和结果，不存日志正文 |
| `data/deploy-logs/<项目 id>/<部署 id>.log` | 每次部署的日志文件 |
| `$REPOS_DIR/<slug>/` | 克隆的代码、`.env`、`docker-compose.deploy.yaml` |
| `secrets/` | Git 私钥 |
| `data/traefik/` | Traefik 静态配置 |
| `data/letsencrypt/acme.json` | Let's Encrypt 证书存储 |

## Let's Encrypt

自带 Traefik 时，migrate 会按 `data/config.json` 写出静态配置。项目证书由各仓库 compose 的 labels 申请，面板不再给项目打 labels。机器的 80 端口必须能被 Let's Encrypt 访问。
