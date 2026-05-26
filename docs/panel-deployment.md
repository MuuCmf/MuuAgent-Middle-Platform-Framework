# 面板部署指南

## 目录

- [概述](#概述)
- [宝塔面板部署](#宝塔面板部署)
  - [环境准备](#宝塔环境准备)
  - [Docker 部署](#宝塔-docker-部署)
  - [Nginx 反向代理配置](#宝塔-nginx-反向代理配置)
  - [SSL 证书配置](#宝塔-ssl-证书配置)
  - [管理维护](#宝塔管理维护)
- [1Panel 面板部署](#1panel-面板部署)
  - [环境准备](#1panel-环境准备)
  - [Docker 部署](#1panel-docker-部署)
  - [Nginx 反向代理配置](#1panel-nginx-反向代理配置)
  - [SSL 证书配置](#1panel-ssl-证书配置)
  - [管理维护](#1panel-管理维护)
- [站点管理方式部署](#站点管理方式部署)
  - [宝塔面板站点管理部署](#宝塔面板站点管理部署)
  - [1Panel 站点管理部署](#1panel-站点管理部署)
  - [站点管理方式优势](#站点管理方式优势)
- [面板部署通用说明](#面板部署通用说明)
  - [配置对比](#配置对比)
  - [迁移指南](#迁移指南)
  - [注意事项](#注意事项)
  - [生产环境文件清单](#生产环境文件清单)
    - [数据库初始化](#5-数据库初始化)
    - [方式一：迁移部署](#52-方式一迁移部署推荐适用于干净数据库)
    - [方式二：直接同步](#53-方式二直接同步适用于迁移失败的场景)
    - [方式三：导入 SQL](#54-方式三导入完整-sql-脚本)
    - [初始化种子数据](#55-初始化种子数据可选)
    - [启动应用](#56-启动应用)
    - [验证部署](#57-验证部署)

## 概述

宝塔面板和 1Panel 是两款流行的 Linux 服务器管理面板，提供图形化的网站、数据库、Docker 管理功能。

使用面板部署 MuuAgent 的核心流程一致：

1. 通过面板安装 Docker 环境
2. 使用 docker-compose 启动所有服务
3. 通过面板配置 Nginx 反向代理和 SSL 证书

---

## 宝塔面板部署

### 宝塔环境准备

#### 1. 安装宝塔面板

```bash
# CentOS / Ubuntu / Deepin
wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && bash install.sh

# 安装完成后访问面板地址，记录用户名和密码
```

#### 2. 安装必要软件

登录宝塔面板 → 软件商店 → 搜索并安装：

| 软件           | 版本要求      | 用途            |
|---------------|-------------|----------------|
| Docker        | 20.10+      | 容器化部署        |
| Docker Compose | 2.0+       | 多容器编排        |
| Nginx         | 1.22+       | 反向代理          |
| MySQL         | 8.0+        | 数据库（可选）     |

> 如果宝塔软件商店中没有 Docker，可通过终端安装：
> ```bash
> curl -fsSL https://get.docker.com | bash
> systemctl enable docker
> systemctl start docker
> ```

#### 3. 开放端口

宝塔面板 → 安全 → 放行端口：

| 端口    | 说明              |
|--------|------------------|
| 3002   | 应用 API 服务      |
| 3306   | MySQL（建议仅内网） |
| 80     | HTTP              |
| 443    | HTTPS             |

### 宝塔 Docker 部署

#### 1. 上传项目文件

方法一：宝塔面板文件管理

- 进入宝塔面板 → 文件
- 在 `/www/wwwroot/` 目录下创建 `muuagent` 文件夹
- 上传项目代码（或使用 Git）

```bash
# 方法二：终端 Git 拉取
cd /www/wwwroot
git clone <repository-url> muuagent
cd muuagent
```

#### 2. 配置环境变量

```bash
cd /www/wwwroot/muuagent
cp service/.env.example service/.env
```

编辑 `service/.env`（宝塔面板 → 文件 → 双击打开）：

```env
# 数据库配置（Docker 内使用服务名连接）
DATABASE_URL="mysql://muu_ai:your-password@mysql:3306/muu_ai_platform?connection_limit=10&pool_timeout=30"

# JWT 密钥（务必修改）
JWT_SECRET="your-jwt-secret"

# 日志级别
LOG_LEVEL="warn"
```

#### 3. 构建并启动服务

宝塔面板 → 终端 或 SSH 执行：

```bash
cd /www/wwwroot/muuagent

# 构建镜像
docker-compose build

# 启动所有服务
docker-compose up -d

# 查看运行状态
docker-compose ps

# 初始化数据库
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx ts-node prisma/init-admin.ts
docker-compose exec app npx ts-node prisma/init-templates.ts
```

#### 4. 验证服务

```bash
curl http://localhost:3002/health
# 预期返回: {"status":"ok",...}
```

### 宝塔 Nginx 反向代理配置

#### 1. 添加站点

宝塔面板 → 网站 → 添加站点：

| 配置项     | 值                          |
|-----------|----------------------------|
| 域名       | `your-domain.com`          |
| 解析       | 指向服务器 IP                |
| PHP 版本   | 纯静态                      |

#### 2. 配置反向代理

点击站点名称 → 反向代理 → 添加反向代理：

| 配置项       | 值                        |
|-------------|---------------------------|
| 代理名称     | `muuagent-api`            |
| 目标 URL    | `http://127.0.0.1:3002`   |
| 发送域名     | `$host`                   |

#### 3. 修改配置文件

点击站点名称 → 配置文件，替换为以下内容：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书（宝塔面板会自动配置）
    ssl_certificate    /www/server/panel/vhost/cert/your-domain.com/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # 请求体大小限制
    client_max_body_size 20M;

    # ==========================================
    # 管理后台静态文件
    # ==========================================
    location /admin/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Api-Key $http_x_api_key;
        proxy_set_header X-Uid $http_x_uid;
    }

    # ==========================================
    # 用户端静态文件
    # ==========================================
    location /client/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Api-Key $http_x_api_key;
        proxy_set_header X-Uid $http_x_uid;
    }

    # ==========================================
    # API 接口
    # ==========================================
    location /api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Api-Key $http_x_api_key;
        proxy_set_header X-Uid $http_x_uid;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # ==========================================
    # SSE 流式接口（长超时）
    # ==========================================
    location /api/ai/stream {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Api-Key $http_x_api_key;
        proxy_set_header X-Uid $http_x_uid;
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # ==========================================
    # Swagger 文档
    # ==========================================
    location /api-docs {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # ==========================================
    # 健康检查
    # ==========================================
    location /health {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 根路径重定向到管理后台
    location = / {
        return 301 /admin/;
    }
}
```

### 宝塔 SSL 证书配置

#### 方式一：宝塔免费 SSL（推荐）

站点设置 → SSL → 申请 Let's Encrypt 免费证书 → 勾选域名 → 申请

#### 方式二：手动上传证书

站点设置 → SSL → 上传证书：

```nginx
# 证书文件: /www/server/panel/vhost/cert/your-domain.com/fullchain.pem
# 私钥文件: /www/server/panel/vhost/cert/your-domain.com/privkey.pem
```

### 宝塔管理维护

#### 查看服务状态

宝塔面板 → Docker → 容器 → 查看 `muu_ai_*` 容器状态

或终端：

```bash
docker-compose ps
docker-compose logs -f app
```

#### 重启服务

```bash
cd /www/wwwroot/muuagent
docker-compose restart app
```

#### 备份数据库

宝塔面板 → 数据库 → 选择 `muu_ai_platform` → 备份

或使用备份脚本：

```bash
cd /www/wwwroot/muuagent
# 先通过 .env 设置密码
export MYSQL_ROOT_PASSWORD="your-password"
./deploy/scripts/backup-mysql.sh
```

#### 更新版本

```bash
cd /www/wwwroot/muuagent

# 拉取最新代码
git pull

# 重新构建并重启
docker-compose build
docker-compose up -d

# 执行数据库迁移
docker-compose exec app npx prisma migrate deploy
```

---

## 1Panel 面板部署

### 1Panel 环境准备

#### 1. 安装 1Panel

```bash
# 官方安装命令
curl -sSL https://resource.fit2cloud.com/1panel/package/quick_start.sh -o quick_start.sh && bash quick_start.sh

# 安装完成后访问面板地址，记录用户名和密码
```

#### 2. 确认 Docker 环境

1Panel 安装时自带 Docker 和 Docker Compose，登录面板后检查：

1Panel 面板 → 容器 → 确认 Docker 状态为运行中

```bash
# 终端验证
docker --version
docker compose version
```

#### 3. 开放端口

1Panel 面板 → 安全 → 防火墙 → 放行端口：

| 端口    | 协议 | 说明              |
|--------|------|------------------|
| 3002   | TCP  | 应用 API 服务      |
| 80     | TCP  | HTTP              |
| 443    | TCP  | HTTPS             |

### 1Panel Docker 部署

#### 1. 上传项目文件

**方法一：1Panel 文件管理**

1Panel 面板 → 文件 → 进入 `/opt/` 目录 → 创建 `muuagent` 文件夹 → 上传项目代码

**方法二：终端 Git 拉取**

```bash
cd /opt
git clone <repository-url> muuagent
cd muuagent
```

#### 2. 配置环境变量

```bash
cd /opt/muuagent
cp service/.env.example service/.env
```

1Panel 面板 → 文件 → 编辑 `service/.env`：

```env
DATABASE_URL="mysql://muu_ai:your-password@mysql:3306/muu_ai_platform?connection_limit=10&pool_timeout=30"
JWT_SECRET="your-jwt-secret"
LOG_LEVEL="warn"
```

#### 3. 构建并启动服务

1Panel 面板 → 终端 或 SSH 执行：

```bash
cd /opt/muuagent

# 构建镜像
docker compose build

# 启动所有服务
docker compose up -d

# 查看运行状态
docker compose ps

# 初始化数据库
docker compose exec app npx prisma migrate deploy
docker compose exec app npx ts-node prisma/init-admin.ts
docker compose exec app npx ts-node prisma/init-templates.ts
```

> **注意**: 1Panel 使用 `docker compose`（无连字符）而非 `docker-compose`。

#### 4. 验证服务

```bash
curl http://localhost:3002/health
# 预期返回: {"status":"ok",...}
```

### 1Panel Nginx 反向代理配置

#### 1. 添加网站

1Panel 面板 → 网站 → 创建网站 → 反向代理：

| 配置项     | 值                          |
|-----------|----------------------------|
| 域名       | `your-domain.com`          |
| 主目录     | 选择「反向代理」             |
| 代理地址   | `http://127.0.0.1:3002`    |
| 启用 HTTPS | 是（如已配置证书）           |

#### 2. 修改配置文件

1Panel 面板 → 网站 → 点击域名 → 配置 → 修改 Nginx 配置，替换为：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书（1Panel 自动管理）
    ssl_certificate /etc/nginx/ssl/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    client_max_body_size 20M;

    # 管理后台
    location /admin/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Api-Key $http_x_api_key;
        proxy_set_header X-Uid $http_x_uid;
    }

    # 用户端
    location /client/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Api-Key $http_x_api_key;
        proxy_set_header X-Uid $http_x_uid;
    }

    # API 接口
    location /api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Api-Key $http_x_api_key;
        proxy_set_header X-Uid $http_x_uid;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # SSE 流式接口
    location /api/ai/stream {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Api-Key $http_x_api_key;
        proxy_set_header X-Uid $http_x_uid;
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location /api-docs {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /health {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location = / {
        return 301 /admin/;
    }
}
```

### 1Panel SSL 证书配置

#### 方式一：1Panel ACME（推荐）

1Panel 面板 → 网站 → 证书 → 申请证书：

| 配置项     | 值                          |
|-----------|----------------------------|
| 证书类型   | Let's Encrypt               |
| 域名       | your-domain.com             |
| 验证方式   | DNS 手动验证 或 HTTP 验证     |
| DNS 服务商 | 根据域名注册商选择             |

申请成功后自动关联到网站。

#### 方式二：手动上传

1Panel 面板 → 网站 → 证书 → 上传证书 → 填写证书内容 → 关联到网站

### 1Panel 管理维护

#### 查看容器

1Panel 面板 → 容器 → 容器管理 → 查看 `muu_ai_*` 容器

支持图形化启动、停止、重启、查看日志。

#### 重启服务

```bash
cd /opt/muuagent
docker compose restart app
```

#### 备份数据库

1Panel 面板 → 数据库 → MySQL → 选择数据库 → 备份

#### 更新版本

```bash
cd /opt/muuagent

# 拉取最新代码
git pull

# 重新构建并重启
docker compose build
docker compose up -d

# 执行数据库迁移
docker compose exec app npx prisma migrate deploy
```

---

## 站点管理方式部署

站点管理方式是通过面板的网站管理功能，直接将域名绑定到应用服务，无需手动配置复杂的 Nginx 反向代理。

### 宝塔面板站点管理部署

#### 1. 准备工作

确保 MuuAgent 服务已正常运行：

```bash
cd /www/wwwroot/muuagent
docker-compose up -d
```

#### 2. 创建站点

宝塔面板 → 网站 → 添加站点：

| 配置项     | 值                          |
|-----------|----------------------------|
| 域名       | `your-domain.com`          |
| 解析       | 指向服务器 IP                |
| PHP 版本   | 纯静态                      |

#### 3. 设置反向代理（站点管理方式）

点击站点名称 → **反向代理** → 添加反向代理：

| 配置项       | 值                        |
|-------------|---------------------------|
| 代理名称     | `muuagent-api`            |
| 目标 URL    | `http://127.0.0.1:3002`   |
| 发送域名     | `$host`                   |
| 开启 WebSocket | 是                       |

#### 4. 配置路径转发

宝塔面板 → 网站 → 点击站点 → **配置文件**，添加以下 location 规则：

```nginx
# 管理后台
location /admin/ {
    proxy_pass http://127.0.0.1:3002;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# 用户端
location /client/ {
    proxy_pass http://127.0.0.1:3002;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

# SSE 流式接口
location /api/ai/stream {
    proxy_pass http://127.0.0.1:3002;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding on;
    proxy_read_timeout 300s;
}
```

#### 5. 配置 SSL 证书

宝塔面板 → 网站 → 点击站点 → **SSL** → 申请 Let's Encrypt 证书

#### 6. 验证部署

访问 `https://your-domain.com/admin/` 查看管理后台

---

### 1Panel 站点管理部署

#### 1. 准备工作

确保 MuuAgent 服务已正常运行：

```bash
cd /opt/muuagent
docker compose up -d
```

#### 2. 创建站点

1Panel 面板 → 网站 → 创建网站：

| 配置项     | 值                          |
|-----------|----------------------------|
| 域名       | `your-domain.com`          |
| 主目录     | 选择「反向代理」             |
| 代理地址   | `http://127.0.0.1:3002`    |
| 启用 HTTPS | 是                         |

#### 3. 配置路径规则

1Panel 面板 → 网站 → 点击域名 → **配置** → **反向代理规则**：

添加以下规则：

| 路径         | 目标地址                  | 备注           |
|-------------|--------------------------|---------------|
| `/admin/`   | `http://127.0.0.1:3002`  | 管理后台       |
| `/client/`  | `http://127.0.0.1:3002`  | 用户端         |
| `/api/`     | `http://127.0.0.1:3002`  | API 接口       |
| `/api/ai/stream` | `http://127.0.0.1:3002` | SSE 流式接口   |

#### 4. 配置高级选项

1Panel 面板 → 网站 → 点击域名 → **配置** → **高级配置**：

- **请求超时**：设置为 300 秒（针对 SSE 流式接口）
- **WebSocket**：启用
- **HTTP/2**：启用

#### 5. 配置 SSL 证书

1Panel 面板 → 网站 → **证书** → 申请 Let's Encrypt 证书

#### 6. 验证部署

访问 `https://your-domain.com/admin/` 查看管理后台

---

### 站点管理方式优势

| 特性                | 传统配置方式               | 站点管理方式               |
|--------------------|---------------------------|---------------------------|
| 配置复杂度          | 需要手动编写 Nginx 配置      | 图形化界面配置，简单直观    |
| SSL 证书管理        | 手动配置证书路径            | 面板自动管理证书           |
| 路径规则管理        | 需要编辑配置文件            | 可视化添加路径规则          |
| 配置备份与迁移      | 需要手动备份配置文件         | 面板自动备份配置           |
| 多站点管理          | 需要管理多个配置文件         | 统一管理界面               |

---

## 面板部署通用说明

### 配置对比

| 特性            | 宝塔面板                       | 1Panel                       |
|----------------|-------------------------------|------------------------------|
| 安装 Docker    | 需手动安装或应用商店安装          | 安装时自动安装                 |
| Docker Compose | 命令为 `docker-compose`         | 命令为 `docker compose`       |
| 项目路径       | `/www/wwwroot/muuagent`        | `/opt/muuagent`              |
| 网站配置       | 网站 → 反向代理 → 修改配置文件    | 网站 → 配置 → 修改 Nginx 配置 |
| SSL 证书       | 站点设置 → SSL                  | 证书 → 申请证书               |
| 数据库管理     | 数据库 → phpMyAdmin             | 数据库 → MySQL → 管理         |
| 文件管理       | 文件 → 可视化管理                | 文件 → 可视化管理              |

### 迁移指南

#### 从宝塔迁移到 1Panel

```bash
# 1. 宝塔端备份数据
cd /www/wwwroot/muuagent
docker-compose exec app npx prisma migrate deploy  # 确保数据库是最新
./deploy/scripts/backup-mysql.sh                    # 备份数据库

# 2. 复制项目文件和备份到新服务器
scp -r /www/wwwroot/muuagent root@new-server:/opt/
scp /backups/mysql/latest.sql.gz root@new-server:/tmp/

# 3. 1Panel 端恢复
cd /opt/muuagent
# 恢复数据库
gunzip < /tmp/latest.sql.gz | docker exec -i muu_ai_mysql mysql -uroot -p${MYSQL_ROOT_PASSWORD} muu_ai_platform
# 启动服务
docker compose build
docker compose up -d
```

### 注意事项

1. **路径差异**：宝塔默认项目路径为 `/www/wwwroot/`，1Panel 为 `/opt/`
2. **命令差异**：宝塔使用 `docker-compose`（有连字符），1Panel 使用 `docker compose`（无连字符）
3. **权限问题**：确保项目目录对 Docker 容器可读
4. **端口冲突**：如果 3002 端口被占用，修改 `docker-compose.yml` 中的端口映射
5. **防火墙**：配置完 Nginx 后，建议关闭 3002 端口的外部访问，仅通过 Nginx 代理访问
6. **内存限制**：面板部署建议服务器内存不低于 4GB

```bash
# 关闭 3002 端口的外部访问（面板防火墙中禁用）
# 仅保留 80 和 443 端口对外开放
```

7. **日志查看**：出现问题时优先查看 Docker 容器日志：

```bash
docker-compose logs -f app      # 宝塔
docker compose logs -f app      # 1Panel
```

8. **静态资源**：如果管理后台或用户端页面空白，确认 Dockerfile 是否正确构建了前端：

```bash
docker-compose exec app ls -la /app/public/
# 应包含 admin/ 和 client/ 目录
```

9. **第三方应用接入**：调用业务 API 时需传递以下请求头：

| 请求头 | 说明 | 必填 |
|--------|------|------|
| `x-api-key` | 租户 API 密钥（在管理后台创建租户时生成） | 是 |
| `x-uid` | 用户标识，用于数据隔离 | 否 |

验证示例：
```bash
curl -H "x-api-key: tn_xxxxxxxx" \
     -H "x-uid: user_12345" \
     http://your-domain.com/api/ai/chat
```

### 生产环境文件清单

生产环境部署时，需要确保以下目录和文件完整。这些文件是应用正常运行所必需的。

#### 1. 编译输出目录 `dist/`

```
dist/
├── src/                    # 编译后的源代码（必需）
│   ├── main.js             # 应用入口
│   ├── app.module.js       # 主模块
│   └── ...                 # 其他编译后的模块
├── prisma/                 # 编译后的 Prisma 脚本（必需）
│   ├── init-admin.js       # 初始化管理员脚本
│   └── seeds/
│       └── prompt-templates.js  # 种子数据脚本
└── public/                 # 公共静态文件（如果存在）
```

**说明：**
- `dist/src/` - TypeScript 源代码编译后的 JavaScript 文件
- `dist/prisma/` - 包含编译后的初始化脚本，生产环境无需 TypeScript 依赖

#### 2. 技能目录 `skills/`（根目录）

```
skills/
└── standard/               # 标准技能目录（必需）
    ├── _public/            # 公开技能
    │   └── ...             # 各种技能定义
    └── app-{code}/         # 应用级技能（可选）
        └── ...
```

**说明：**
- 技能文件位于根目录 `skills/`，不在 `dist/` 内
- `process.cwd()` = `service/`，扫描路径为 `service/skills/standard`
- 生产环境启动命令 `node dist/src/main` 在 `service/` 目录执行

#### 3. Prisma 相关 `prisma/`

```
prisma/
├── schema.prisma           # 数据库 schema 定义（必需）
├── migrations/             # 数据库迁移文件（必需）
│   ├── migration_lock.toml # 迁移锁文件
│   └── 20260511213356_init/
│       └── migration.sql   # 迁移 SQL
│   └── ...                 # 其他迁移文件
└── seeds/                  # 种子数据源文件（可选）
    ├── prompt-templates.sql
    └── prompt-templates.ts
```

**说明：**
- `schema.prisma` - 用于生成 Prisma Client，数据库结构定义
- `migrations/` - 生产环境数据库迁移必需，包含所有数据库变更历史
- `seeds/` - 种子数据源文件，可选，用于初始化基础数据

#### 4. 配置文件

```
service/
├── package.json            # 依赖管理（必需）
├── package-lock.json       # 依赖锁定文件（必需）
├── .env.example            # 环境变量示例（推荐）
└── .env                    # 环境变量（必需，需根据 .env.example 创建）
```

**说明：**
- `package.json` 和 `package-lock.json` - 定义运行时依赖
- `.env` - 生产环境配置，包含数据库连接、JWT 密钥等敏感信息

#### 5. 运行时依赖

```
node_modules/               # 依赖包（必需，通过 npm ci 安装）
```

**说明：**
- 生产环境通过 `npm ci --production` 安装依赖
- 不包含开发依赖（如 TypeScript、测试工具等）

#### 6. 数据库初始化

##### 6.1 前置准备

首次部署前，需要先创建数据库：

```bash
# 登录 MySQL
mysql -u root -p

# 创建数据库（数据库名需与 .env 中 DATABASE_URL 配置一致）
CREATE DATABASE IF NOT EXISTS muuagent_middle_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

##### 6.2 方式一：迁移部署（推荐，适用于干净数据库）

这是标准的生产部署方式，适用于全新的空数据库：

```bash
# 1. 安装依赖
npm ci --production

# 2. 生成 Prisma Client
npx prisma generate

# 3. 执行数据库迁移
npx prisma migrate deploy

# 4. 生成 Prisma Client（迁移后更新）
npx prisma generate

# 5. 执行初始化脚本
node dist/prisma/init-admin.js
```

##### 6.3 方式二：直接同步（适用于迁移失败的场景）

如果 `prisma migrate deploy` 因迁移文件问题失败，可使用 `prisma db push` 直接根据 schema 同步表结构：

```bash
# 1. 安装依赖
npm ci --production

# 2. 生成 Prisma Client
npx prisma generate

# 3. 直接同步表结构（跳过迁移历史，基于 schema.prisma 直接创建）
npx prisma db push

# 4. 将迁移标记为已应用（确保迁移记录与数据库状态一致）
npx prisma migrate resolve --applied 20260511213356_init
npx prisma migrate resolve --applied 20260512162842_remove_agent_invoke_log_token_fields
npx prisma migrate resolve --applied 20260512172551_add_appcode_to_skill_kb_logs
npx prisma migrate resolve --applied 20260516020604_add_workspace_config_to_agent
npx prisma migrate resolve --applied 20260518_remove_skills_table
npx prisma migrate resolve --applied 20260519_change_steps_to_longtext
npx prisma migrate resolve --applied 20260522_remove_workspace_config_from_agent

# 5. 执行初始化脚本
node dist/prisma/init-admin.js
```

##### 6.4 方式三：导入完整 SQL 脚本

如果有完整的数据库导出 SQL，可直接导入：

```bash
# 导入完整数据库（包含表结构和初始数据）
mysql -u root -p muuagent_middle_platform < /path/to/backup.sql

# 将迁移标记为已应用（使 _prisma_migrations 表与实际表结构一致）
npx prisma migrate resolve --applied 20260511213356_init
npx prisma migrate resolve --applied 20260512162842_remove_agent_invoke_log_token_fields
npx prisma migrate resolve --applied 20260512172551_add_appcode_to_skill_kb_logs
npx prisma migrate resolve --applied 20260516020604_add_workspace_config_to_agent
npx prisma migrate resolve --applied 20260518_remove_skills_table
npx prisma migrate resolve --applied 20260519_change_steps_to_longtext
npx prisma migrate resolve --applied 20260522_remove_workspace_config_from_agent

# 生成 Prisma Client
npx prisma generate
```

##### 6.5 初始化种子数据（可选）

初始化脚本完成后，可根据需要导入种子数据：

```bash
# 方式一：使用 Prisma 脚本（推荐）
node dist/prisma/seeds/prompt-templates.js

# 方式二：直接导入 SQL（需确认表结构已存在）
mysql -u root -p muuagent_middle_platform < prisma/seeds/prompt-templates.sql
mysql -u root -p muuagent_middle_platform < prisma/init-templates.sql
```

##### 6.6 启动应用

```bash
# 启动应用
node dist/src/main
```

##### 6.7 验证部署

```bash
# 验证服务是否正常
curl http://localhost:3002/health

# 验证数据库已生成正确的表（应看到 agents、users 等核心表）
mysql -u root -p -e "USE muuagent_middle_platform; SHOW TABLES;"
```

#### 6. 不需要的文件（开发环境专用）

以下文件在生产环境中不需要，部署时可以排除：

- `src/` - TypeScript 源代码
- `prisma/init-admin.ts` - TypeScript 源码
- `prisma/init-templates.js` - 开发环境脚本
- `prisma/init-templates.sql` - 开发环境脚本
- `tsconfig.json` - TypeScript 配置
- `nest-cli.json` - NestJS CLI 配置
- `jest.config.js` - 测试配置
- `scripts/` - 开发脚本
- `.gitignore` - Git 配置
- `README.md` - 文档

#### 7. 关键点说明

1. **`dist/prisma/` 必需**：包含编译后的初始化脚本，生产环境无需 TypeScript 依赖即可执行
2. **`prisma/schema.prisma` 必需**：用于生成 Prisma Client，数据库操作的基础
3. **`prisma/migrations/` 必需**：生产环境数据库迁移必需，确保数据库结构同步
4. **`dist/skills/` 必需**：通过 nest-cli.json 配置自动复制到 dist 目录，技能功能必需
5. **环境变量**：需要根据 `.env.example` 创建生产环境的 `.env` 文件，包含正确的配置

#### 8. Docker 部署说明

使用 Docker 部署时，上述文件清单已包含在 Docker 镜像中。部署流程：

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 初始化数据库 - 方式一：迁移部署（推荐）
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma generate

# 如果迁移执行失败（如 P3009、P3018 错误），改用直接同步：
docker-compose exec app npx prisma db push
docker-compose exec app npx prisma migrate resolve --applied 20260511213356_init
docker-compose exec app npx prisma migrate resolve --applied 20260512162842_remove_agent_invoke_log_token_fields
docker-compose exec app npx prisma migrate resolve --applied 20260512172551_add_appcode_to_skill_kb_logs
docker-compose exec app npx prisma migrate resolve --applied 20260516020604_add_workspace_config_to_agent
docker-compose exec app npx prisma migrate resolve --applied 20260518_remove_skills_table
docker-compose exec app npx prisma migrate resolve --applied 20260519_change_steps_to_longtext
docker-compose exec app npx prisma migrate resolve --applied 20260522_remove_workspace_config_from_agent

# 初始化管理员账号
docker-compose exec app node dist/prisma/init-admin.js

# （可选）初始化种子数据
docker-compose exec app node dist/prisma/seeds/prompt-templates.js
```

Docker 镜像已包含所有必需文件，无需手动上传 `dist/` 目录。