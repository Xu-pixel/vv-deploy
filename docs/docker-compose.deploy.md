# 怎样写 `docker-compose.deploy.yaml`

把这个文件放在仓库根目录并提交。面板部署时原样使用它，不会改写内容、不会补域名、也不会改端口。

也认 `docker-compose.deploy.yml`。两份都在时，只用 `.yaml`。普通的 `docker-compose.yml` 不会被部署。

## 面板实际执行的命令

部署前，面板把页面上保存的环境变量写回当前使用的环境变量文件，再把它传给 `--env-file`，然后执行：

```bash
docker compose \
  --env-file <环境变量文件> \
  -f docker-compose.deploy.yaml \
  --project-directory <仓库目录> \
  --project-name <文件夹名> \
  up -d --build
```

因此：

- 项目名是 `REPOS_DIR` 下的文件夹名，不是文件里的 `name:`。
- 文件里的 `${COMPOSE_PROJECT_NAME}` 会变成这个文件夹名。路由名用它，避免和别的仓库撞车。
- `${VAR}` 从面板写入的环境变量文件替换。
- 服务写了 `env_file`（例如 `.env.local`）且该文件存在时，面板读写这个文件。文件不存在时，改为读写仓库根目录的 `.env`。没有 `env_file` 时也读写 `.env`。
- `build: .` 以及 `./data` 这类相对路径，都相对仓库根目录。
- `git pull` 会保留面板写过的 `.env` 和 compose 里的 `env_file`。密钥放在这些文件里，不要写进 YAML，也不要提交它们。

环境变量名只能是字母、数字和下划线，且不能以数字开头。

## 反向代理

域名写在这个文件里。面板不分配域名。

默认接到外部网络 `traefik`。管理员如果改过 `TRAEFIK_NETWORK`，这里的网络名要改成同一个。证书解析器名是 `letsencrypt`。入口是 `web`（80）和 `websecure`（443）。

Traefik 默认不暴露容器，所以对外的服务必须写 `traefik.enable=true`。`loadbalancer.server.port` 填容器里进程监听的端口，不是宿主机端口。

数据库、队列、定时任务不要挂到公网：`traefik.enable=false`，也不要写 `ports:`。

## 模板

把 `app.example.com` 和 `3000` 换成自己的域名和容器端口。

```yaml
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file:
      - .env
    expose:
      - "3000"
    labels:
      - traefik.enable=true
      - traefik.docker.network=traefik
      - traefik.http.routers.${COMPOSE_PROJECT_NAME}.rule=Host(`app.example.com`)
      - traefik.http.routers.${COMPOSE_PROJECT_NAME}.entrypoints=web,websecure
      - traefik.http.routers.${COMPOSE_PROJECT_NAME}.tls=true
      - traefik.http.routers.${COMPOSE_PROJECT_NAME}.tls.certresolver=letsencrypt
      - traefik.http.services.${COMPOSE_PROJECT_NAME}.loadbalancer.server.port=3000
    networks:
      - default
      - traefik

networks:
  traefik:
    external: true
    name: traefik
```

多个对外服务时，路由名加上服务名，例如 `${COMPOSE_PROJECT_NAME}-web` 和 `${COMPOSE_PROJECT_NAME}-api`。两个服务共用一个路由名会互相覆盖。

## 带数据库

只有 `web` 进 Traefik。数据库走内部网络，数据放命名卷。

```yaml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - db_data:/var/lib/postgresql/data
    labels:
      - traefik.enable=false
    networks:
      - default

  web:
    build: .
    restart: unless-stopped
    env_file:
      - .env
    depends_on:
      - db
    expose:
      - "3000"
    labels:
      - traefik.enable=true
      - traefik.docker.network=traefik
      - traefik.http.routers.${COMPOSE_PROJECT_NAME}.rule=Host(`app.example.com`)
      - traefik.http.routers.${COMPOSE_PROJECT_NAME}.entrypoints=web,websecure
      - traefik.http.routers.${COMPOSE_PROJECT_NAME}.tls=true
      - traefik.http.routers.${COMPOSE_PROJECT_NAME}.tls.certresolver=letsencrypt
      - traefik.http.services.${COMPOSE_PROJECT_NAME}.loadbalancer.server.port=3000
    networks:
      - default
      - traefik

volumes:
  db_data:

networks:
  traefik:
    external: true
    name: traefik
```

Compose 命令里要写字面量 `$` 时写成 `$$`，否则会被当成变量替换掉。

## 上线前核对

1. 文件在仓库根目录，文件名是 `docker-compose.deploy.yaml` 或 `docker-compose.deploy.yml`。
2. 对外服务有 `env_file: .env`，密钥只出现在面板的环境变量里。
3. `traefik.docker.network` 和 `networks.<名字>.name` 都是当前这台机器的 Traefik 网络。
4. `Host` 已做 DNS，指向这台机器。使用 Let's Encrypt 时，80 端口要从公网访问到。
5. `loadbalancer.server.port` 等于容器内监听端口。
6. 不对外的服务写了 `traefik.enable=false`，并且没有占用宿主机端口。
