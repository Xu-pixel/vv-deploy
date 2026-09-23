# 怎样写 `docker-compose.deploy.yml`

仓库根目录放 `docker-compose.deploy.yml`（也认 `.yaml`）。两份都在时，面板只用 `.yaml`。普通的 `docker-compose.yml` 不会被部署。

面板不改这份文件。

## 共同约定

- 对外服务写 `traefik.enable=true`，并加入外部网络 `dokploy-network`。
- `traefik.docker.network=dokploy-network`。
- 域名写在 `Host(\`域名\`)` 里。证书解析器是 `letsencrypt`。
- `loadbalancer.server.port` 等于容器里进程监听的端口。用 `expose` 声明这个端口，不要映射宿主机端口。
- 数据库、采集进程这类不对外的服务写 `traefik.enable=false`。
- `restart: unless-stopped`。需要构建时，`build.context` 是仓库根目录，`dockerfile` 是 `Dockerfile`。
- 面板上的标题取对外服务的镜像名（去掉标签），例如 `my-app:latest`。域名取上面的 `Host`。

网络段固定写成：

```yaml
networks:
  dokploy-network:
    external: true
    name: dokploy-network
```

## 环境变量

两种都在用：

- 服务上写 `env_file: .env.local`。这个文件存在时，面板读写它。
- 不写 `env_file`，把变量放在 `environment` 的 `${VAR}` 里。面板读写仓库根目录的 `.env`，部署时用它做替换。

`env_file` 指到的文件如果不存在，面板改为读写 `.env`。`git pull` 会保留这两处文件。密钥不要写进 YAML，也不要提交。

变量名只能是字母、数字和下划线，且不能以数字开头。Compose 命令里要写字面量 `$` 时写成 `$$`。

## 单个 Web 服务

HTTP 和 HTTPS 分成两个路由。HTTP 走已有的 `redirect-to-https@file`，HTTPS 申请证书。路由名在这台机器上不能重复。

```yaml
services:
  app:
    image: my-app:latest
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file:
      - .env.local
    expose:
      - "3000"
    labels:
      - traefik.enable=true
      - traefik.docker.network=dokploy-network
      - traefik.http.routers.myapp-http.rule=Host(`app.example.com`)
      - traefik.http.routers.myapp-http.entrypoints=web
      - traefik.http.routers.myapp-http.middlewares=redirect-to-https@file
      - traefik.http.routers.myapp-http.service=myapp
      - traefik.http.routers.myapp.rule=Host(`app.example.com`)
      - traefik.http.routers.myapp.entrypoints=websecure
      - traefik.http.routers.myapp.tls=true
      - traefik.http.routers.myapp.tls.certresolver=letsencrypt
      - traefik.http.routers.myapp.tls.domains[0].main=app.example.com
      - traefik.http.services.myapp.loadbalancer.server.port=3000
    networks:
      - default
      - dokploy-network

networks:
  dokploy-network:
    external: true
    name: dokploy-network
```

## 带数据库和后台进程

只有 `web` 进 Traefik，HTTP 和 HTTPS 写在同一个路由上。数据库只走 `default`。后台进程同样 `traefik.enable=false`。变量用 `${VAR}`，不写 `env_file`。

```yaml
services:
  db:
    image: mysql:8.0
    restart: unless-stopped
    environment:
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
    volumes:
      - db_data:/var/lib/mysql
    labels:
      - traefik.enable=false
    networks:
      - default

  web:
    image: my-app:latest
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      DB_HOST: db
      DB_NAME: ${DB_NAME}
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
    depends_on:
      - db
    expose:
      - "8088"
    labels:
      - traefik.enable=true
      - traefik.docker.network=dokploy-network
      - traefik.http.routers.myapp.rule=Host(`app.example.com`)
      - traefik.http.routers.myapp.entrypoints=web,websecure
      - traefik.http.routers.myapp.tls=true
      - traefik.http.routers.myapp.tls.certresolver=letsencrypt
      - traefik.http.services.myapp.loadbalancer.server.port=8088
    networks:
      - default
      - dokploy-network

  worker:
    image: my-app:latest
    restart: unless-stopped
    environment:
      DB_HOST: db
      DB_NAME: ${DB_NAME}
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
    depends_on:
      - db
    labels:
      - traefik.enable=false
    networks:
      - default

volumes:
  db_data:

networks:
  dokploy-network:
    external: true
    name: dokploy-network
```

## 上线前核对

1. 文件在仓库根目录，文件名是 `docker-compose.deploy.yml` 或 `docker-compose.deploy.yaml`。
2. 对外服务的镜像名就是面板标题，`Host` 就是面板上的域名。
3. 网络是外部网络 `dokploy-network`，标签里的 `traefik.docker.network` 也是这个名字。
4. 需要单独环境变量文件时写 `env_file: .env.local`。不写时，变量放在 `${VAR}` 里，由 `.env` 提供。
5. `loadbalancer.server.port` 等于容器内监听端口。
6. 不对外的服务写了 `traefik.enable=false`，并且没有 `ports:`。
