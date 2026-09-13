# system-updater 中台框架在线更新模块

MuuAgent-Middle-Platform-Framework 的**自更新**模块：请求云端检查版本 → 发现更高版本即自动完成"取升级清单 → 逐文件下载替换（先备份）→ 执行升级 SQL → 更新本地 VERSION"的完整流程。

> 复刻 php_server 在线更新**客户端**逻辑（`php_server/app/admin/controller/Update.php` + `php_server/app/admin/lib/Upgrade.php`），但更新目标是**中台框架自身**，不是 php_server。

## 文件结构

```
system-updater/
├── system-updater.module.ts        # 模块定义（由 src/modules 自动发现机制加载）
├── system-updater.controller.ts    # 接口层（AdminGuard 保护）
├── system-updater.service.ts       # 核心更新流程
├── version-compare.util.ts         # 版本比较（复刻 php version_contrast 语义）
├── auth-code.util.ts               # php 兼容授权码加解密（key='muu'，RC4 变体）
├── dto/run-update.dto.ts           # run 接口入参
└── *.spec.ts                       # 单元测试（jest）
```

## 配置项（service/.env）

| 配置项 | 说明 | 默认/示例 |
|---|---|---|
| `SYSTEM_UPDATER_CLOUD_API` | 云端更新服务器地址，**必须以 / 结尾** | `https://www.muucmf.cc/cloud/` |
| `SYSTEM_UPDATER_SERVER_ROOT` | 中台仓库根目录（更新目标，VERSION 文件所在目录） | `/wwwroot/MuuAI-Middle-Platform` |
| `SYSTEM_UPDATER_APP_NAME` | 应用标识，需与云端注册的中台应用一致 | `muuagent` |
| `SYSTEM_UPDATER_FRAME` | 框架标识，需与云端注册一致 | `muuagent` |
| `SYSTEM_UPDATER_DOMAIN` | 站点域名（生成授权码用，应用模块更新时需要） | 空 |
| `SYSTEM_UPDATER_IP` | 站点 IP（同上） | 空 |
| `SYSTEM_UPDATER_DB_URL` | 升级 SQL 数据库连接（优先），缺省读取 `DATABASE_URL`（中台自身库） | 注释状态 |
| `SYSTEM_UPDATER_DB_PREFIX` | 数据表前缀（替换 upgrade.sql 中的占位前缀 `muuagent_`，与中台数据表实际前缀一致） | `muuagent_` |

> **务必为云端注册独立的应用标识（muuagent/node）**：若误用 `system/t6`，云端会返回 php_server 的升级包，覆盖 Node 代码！

## 接口

### GET /api/admin/system-updater/check — 检查更新

请求云端最新版本并与本地中台仓库根目录 `VERSION` 对比。

```json
// 响应
{
  "code": 200,
  "message": "success",
  "data": {
    "localVersion": "1.3.0",
    "cloudVersion": "1.4.0",
    "remark": "<p>更新日志...</p>",
    "upgradeable": true
  }
}
```

### POST /api/admin/system-updater/run — 执行在线更新

请求体（均可选）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `version` | string | 指定目标版本，缺省取云端最新版本 |
| `dryRun` | boolean | 预览模式：仅返回待更新文件清单，不落盘 |

```json
// 请求示例
{ "dryRun": true }

// 响应（UpdateReport）
{
  "code": 200,
  "data": {
    "localVersion": "1.3.0",
    "cloudVersion": "1.4.0",
    "targetVersion": "1.4.0",
    "upgradeable": true,
    "message": "更新完成，请重启服务使新版本生效",
    "files": [
      { "name": "service/src/main.ts", "md5": "abc...", "status": "pending", "localMd5": "def..." },
      { "name": "node_modules/xxx/index.js", "md5": "...", "status": "ignored" }
    ],
    "results": [
      { "name": "service/src/main.ts", "success": true },
      { "name": "service/src/xxx.ts", "success": false, "error": "模拟云端文件缺失" }
    ],
    "sqlExecuted": true,
    "sqlError": null,
    "versionApplied": true,
    "restartRequired": true
  }
}
```

`files[].status` 分类：`pending` 待更新（本地不存在或 md5 不同）/ `skipped` 本地一致 / `ignored` 命中忽略规则。`results` 仅包含 pending 文件的逐文件执行结果。`restartRequired=true` 表示需重启服务进程新代码才生效。

## 更新流程

```
runUpdate()
 ├─ 1. getLocalVersion()      读中台仓库根目录 VERSION 文件
 ├─ 2. getCloudVersion()      POST {cloud}app/version（form-urlencoded）
 ├─ 3. checkUpgradeable()     云端版本 > 本地版本才继续，否则返回"已经是最新版本"
 ├─ 4. getUpgradeFileList()   POST {cloud}upgrade/{app_name}/version → {data:[{name,md5}],total}
 │      ├─ 命中忽略规则 → ignored（.env、node_modules/、.git/、uploads/、logs/、backups/、VERSION 等）
 │      ├─ 本地存在且 md5 一致 → skipped
 │      └─ 其余 → pending
 ├─ 5. 逐文件 downloadAndReplace()（单文件失败记录后继续，不中断）
 │      ├─ GET {cloud}upgrade/download?app_name&version&md5&frame&auth_code
 │      ├─ content-type 为 application/json → 按 {code,msg} 报错；octet-stream → 正常写盘
 │      ├─ 已存在文件先备份到 backups/{Y-m}/{d}/{旧版本}/{相对路径}
 │      └─ 路径穿越防护（禁止 ../ 逃逸出根目录）
 ├─ 6. executeUpgradeSql()    执行中台仓库根目录 upgrade.sql（存在才执行）
 │      ├─ muucmf_ 占位前缀替换为 SYSTEM_UPDATER_DB_PREFIX（中台表前缀 muuagent_）
 │      ├─ 逐条执行，单条失败仅记录警告继续（复刻 php 语义）
 │      └─ 数据库连接：优先 SYSTEM_UPDATER_DB_URL，缺省 DATABASE_URL
 └─ 7. applyVersion()         写 VERSION = 目标版本（清单中的 VERSION 文件被忽略规则跳过）
```

## 关键实现说明

- **版本比较**：复刻 php `version_contrast`，按 `.` 分段转 int 逐位比较，缺失段按 0（`2.0` 与 `2.0.0` 视为相等，不可升级）。
- **授权码**：`encryptAuthCode(plain, expiry, key)` 严格复刻 php `encrypt_code`（10 位到期时间戳 + md5 校验 16 位 + 原文，keyc 1 位随机前缀，box 打乱后按位直接异或，base64 去等号），已与 PHP 8.0 实测双向互通。系统应用更新免授权；应用模块更新需配置 `SYSTEM_UPDATER_DOMAIN/IP` 生成授权码。
- **响应分流**：php 云端下载接口靠 content-type 区分成败（非 `application/octet-stream` 即错误 JSON），本模块遵循同一约定。
- **忽略规则**：保护 `.env`、`node_modules/`、`.git/`、`uploads/`、`logs/`、`backups/` 等本地环境与运行数据不被云端覆盖；`VERSION` 同样被忽略，由更新流程末尾统一写入目标版本。
- **与 php 客户端的关键差异**：Node 进程不会自动加载新文件，更新完成后必须**重启服务**（接口返回 `restartRequired: true` 与对应提示）。
- **并发保护**：runUpdate 执行期间置运行锁，重复调用返回错误。

## 使用示例（curl）

```bash
TOKEN=<管理员JWT>

# 检查更新
curl http://localhost:9898/api/admin/system-updater/check -H "Authorization: Bearer $TOKEN"

# 预览待更新文件
curl -X POST http://localhost:9898/api/admin/system-updater/run \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"dryRun":true}'

# 执行更新（完成后按提示重启服务）
curl -X POST http://localhost:9898/api/admin/system-updater/run \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
```

## 验证情况

以下分支均已通过端到端实测（mock 云端 + 沙箱目录 + 独立测试库）：

- 版本检查、dryRun 分类、文件替换/新建/一致跳过/忽略规则
- 云端 JSON 错误识别与单文件失败容错（继续更新其余文件）
- 备份目录与旧内容还原、SQL 前缀替换、SQL 单条错误容忍
- 版本号落盘、重复执行幂等（已是最新版本）
- 授权码与 PHP 8.0 双向加解密互通

## 注意事项

1. **云端应用注册**：需在云端按 `app_name=muuagent`、`frame=node` 注册中台应用并发布升级包，否则 check/run 返回"没有查询到相关应用"。
2. 更新会**直接覆盖**中台仓库文件，执行前建议 dryRun 预览并确认备份磁盘空间（备份位于 `backups/{Y-m}/{d}/{旧版本}/`）。
3. 升级包若包含 `upgrade.sql`（位于仓库根目录），会自动对中台数据库执行；含大量 DDL 时建议低峰期操作。
4. **更新完成后必须重启服务**（PM2 reload / systemd restart / 手动重启），否则新旧版本号不一致且新代码不生效。
5. 运行中产物（node_modules、上传文件、日志、.env）受忽略规则保护，不会被云端升级包覆盖。
