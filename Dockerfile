# ===========================================
# AI 中台服务 Dockerfile
# 多阶段构建：后端 + 管理后台 + 用户端
# ===========================================

# ---- 构建阶段 1：后端服务 (NestJS) ----
FROM node:18-alpine AS service-builder

WORKDIR /app

# 单独安装依赖以利用 Docker 缓存
COPY service/package*.json ./
RUN npm ci

# 复制后端源代码
COPY service/ ./

# 生成 Prisma Client
RUN npx prisma generate

# 构建 NestJS 项目
RUN npm run build

# ---- 构建阶段 2：管理后台 (Admin) ----
FROM node:18-alpine AS admin-builder

WORKDIR /app

# 前端构建参数（运行时通过 docker-compose build args 注入）
ARG VITE_API_BASE_URL=""
ARG VITE_WS_URL=""

COPY admin/package*.json ./
RUN npm ci

COPY admin/ ./

# 注入前端环境变量并构建
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_WS_URL=${VITE_WS_URL}
RUN npm run build

# ---- 构建阶段 3：用户端 (Client) ----
FROM node:18-alpine AS client-builder

WORKDIR /app

# 前端构建参数
ARG VITE_API_BASE_URL=""
ARG VITE_WS_URL=""

COPY client/package*.json ./
RUN npm ci

COPY client/ ./

# 注入前端环境变量并构建
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_WS_URL=${VITE_WS_URL}
RUN npm run build

# ---- 生产运行阶段 ----
FROM node:18-alpine

WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache dumb-init wget ca-certificates tzdata

# 设置时区（默认 Asia/Shanghai）
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 创建非 root 用户
RUN addgroup -g 1001 -S appgroup \
    && adduser -S appuser -u 1001 -G appgroup

# 从后端构建阶段复制产物
COPY --from=service-builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=service-builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=service-builder --chown=appuser:appgroup /app/prisma ./prisma
COPY --from=service-builder --chown=appuser:appgroup /app/package.json ./

# 复制标准技能目录
COPY --from=service-builder --chown=appuser:appgroup /app/skills ./skills

# 复制管理后台静态文件
COPY --from=admin-builder --chown=appuser:appgroup /app/dist /app/public/admin

# 复制用户端静态文件
COPY --from=client-builder --chown=appuser:appgroup /app/dist /app/public/client

# 复制启动脚本
COPY --chown=appuser:appgroup deploy/scripts/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# 创建必要的数据目录
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app/uploads

# 切换到非 root 用户
USER appuser

# 暴露端口
EXPOSE 3002

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3002/health || exit 1

# 启动命令
ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/entrypoint.sh"]
