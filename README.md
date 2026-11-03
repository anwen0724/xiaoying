# 素材制作网站

源码仓库：[anwen0724/xiaoying](https://github.com/anwen0724/xiaoying) · 验收 commit：`00e2e1d4dea58407bb5eee1020c62814c157cd6d`

## 技术版本与项目结构

| 部分 | 版本 |
| --- | --- |
| Java／Maven Wrapper | 21／3.9.14 |
| Spring Boot／MyBatis-Plus | 3.5.16／3.5.9（基于 MyBatis，使用 Boot 3 Starter） |
| MySQL | 8.4.13 |
| Node.js／npm | 24.14.0／11.9.0 |
| Next.js／React | 16.4.3／19.3.1 |
| TypeScript／ESLint | 5.9.3／9.39.5 |
| TanStack Query | 5.105.1 |
| Playwright | 1.64.1，浏览器镜像 `v1.64.1-noble` |

前端依赖由 `frontend/package-lock.json` 固定；后端依赖由 `backend/pom.xml`、Spring Boot 依赖管理和 Maven Wrapper 固定。

```text
frontend/
  src/app/                 App Router 页面、加载与错误入口
  src/features/            模板、身份、上传、任务与个人记录
  src/shared/              HTTP 请求与共享组件
  tests/                   浏览器行为和 HTTP 渲染测试
backend/
  src/main/java/com/anwen/xiaoying/
    identity/              演示身份与服务端会话
    template/              模板、分类与种子数据
    asset/                 图片校验、上传与文件读取
    task/                  任务受理、后台执行、状态与历史查询
  src/test/                Java 集成测试
database/init/             数据库结构与用户种子
assets/demo/               模板数据、封面、预置结果与上传样例
scripts/smoke.mjs          成功、失败、排队及身份隔离演示
.github/workflows/ci.yml   GitHub Actions
docs/api.md               完整接口说明
docs/database-design.md   库表、字段与约束
compose.yaml              容器编排
```

浏览器访问 Next.js 的 3000 端口，Next.js 将 `/api/*` 和 `/demo/*` 转发到 Java。Java 负责模板、素材、任务及个人记录业务，通过 MyBatis-Plus 读写 MySQL。容器内 Java 地址为 `backend:8080`，MySQL 地址为 `mysql:3306`；这两个端口不向宿主机开放。

## 启动、配置与初始化

需要 Docker Engine 和 Docker Compose。安装、构建、测试与应用执行均在容器内完成。在仓库根目录执行：

```sh
docker compose up -d --build --wait
```

打开 <http://localhost:3000>。

### 配置

默认配置可以直接用于本地演示。需要调整时，将 [.env.example](.env.example) 复制为 `.env`，修改对应值后重新启动相关服务。

| 配置项 | 默认值 | 作用 |
| --- | --- | --- |
| `FRONTEND_PORT` | `3000` | 宿主机访问端口 |
| `DB_PASSWORD` | `local-demo-password` | 应用数据库账号密码 |
| `MYSQL_ROOT_PASSWORD` | `local-demo-root` | MySQL 初始化 root 密码 |
| `DEMO_MODE` | `true` | 开启演示身份和任务模拟参数 |
| `TASK_WORKERS` | `2` | 后台工作线程数 |
| `TASK_QUEUE_CAPACITY` | `32` | 等待队列容量，不含正在执行的任务 |
| `SIMULATION_STEP_DELAY_MS` | `3000` | 每阶段模拟耗时，单位毫秒，范围 0–30000 |

Compose 已配置 `DB_URL`、`DB_USERNAME=xiaoying` 和 `STORAGE_ROOT=/app/data`。Next.js 默认通过 `http://backend:8080` 访问 Java；更换服务地址时，需要同步配置服务端请求目标及构建时的 `JAVA_API_ORIGIN`，重新构建前端。

`.env.example` 仅包含演示值，`.env` 不纳入 Git。MySQL 初始化账号变量仅在空数据卷生效；已有数据库更改密码时，需要同时更新数据库账号。

### 数据与素材

首次启动 MySQL 时，执行 `database/init/001-schema.sql` 和 `002-demo-users.sql`，建立六张表并添加两个演示用户。Java 启动后读取 `assets/demo/templates.json`，导入缺少的模板并检查预置文件，重复启动不会覆盖已有模板。

项目提供 2 个分类、4 个模板，分别要求 1、2 或 3 张图片。上传样例位于 `assets/demo/inputs/`，支持 JPEG／PNG，单张不超过 5 MiB。封面和预置结果随源码提供，运行时不依赖外部图片服务。

数据库保存在 `mysql-data` 卷；上传文件和任务结果保存在 `file-data` 卷。

## 主要接口与后台执行

以下接口均通过前端同源地址访问。完整协议、校验规则和错误码见[接口文档](docs/api.md)，表结构见[库表设计](docs/database-design.md)。

| 接口 | 主要请求字段 | 主要响应 |
| --- | --- | --- |
| `GET /api/categories` | 无 | `items`：分类 `code`、`name` |
| `GET /api/templates` | 可选 `category` | `items`：模板 `id`、标题、封面、分类及素材要求 |
| `GET /api/templates/{id}` | 模板 ID | 模板描述、`requiredImageCount`、`acceptedMimeTypes`、`maxFileSizeBytes` 等 |
| `POST /api/session` | `userId` | 用户 `id`、`displayName`，设置会话 Cookie |
| `GET /api/session`／`DELETE /api/session` | 会话 Cookie | 当前用户／退出身份 |
| `POST /api/assets` | multipart：`templateId`、`file` | 201；素材 `id`、`originalName`、`mimeType`、`sizeBytes`、`previewUrl` |
| `POST /api/tasks` | `templateId`、有序 `assetIds`、可选 `simulation` | 202；任务 `id`、`status`、`stage`、`version`、时间、`resultUrl`、`failure` |
| `GET /api/tasks/{id}` | 任务 ID | 任务及按执行顺序排列的 `steps` |
| `GET /api/tasks` | 可选 `templateId`、`category`、`limit`、`cursor` | `items`、`nextCursor` |
| `GET /api/tasks/active` | 可选 `category` | 本人未完成任务 |
| `GET /api/tasks/status` | `ids`，每批最多 100 个 | `items`、`missingIds` |
| `GET /api/tasks/{id}/result` | 任务 ID | 本人成功任务的 SVG 图片 |

### 状态与阶段

任务状态为 `QUEUED`（等待）、`RUNNING`（处理中）、`SUCCEEDED`（成功）、`FAILED`（失败）。后台依次执行：

```text
MATERIAL_CHECK       素材检查
       ↓
MOCK_GENERATION      模拟生成
       ↓
RESULT_FINALIZATION  结果整理
```

提交接口完成参数校验和任务登记后返回任务 ID，不等待制作结束。默认由 2 个工作线程处理任务，其余任务排队；队列满时记录调度失败。

各阶段等待配置的耗时。素材检查再次验证输入，模拟生成读取预置 SVG，结果整理将结果副本保存到私有目录。某一步失败后停止执行，后续步骤记为 `SKIPPED`。任务和步骤状态写入 MySQL；查询只读取状态，不推进执行。

前端约每 2 秒查询未完成任务，前一次请求结束后才安排下一次。任务结束后停止跟踪；离开页面或切换身份时清理请求。查询异常保留已有状态，并提供“恢复查询”入口，不将请求异常显示为制作失败。

## 演示方法

### 成功制作、多任务与刷新恢复

1. 在页顶选择“小禾”，从模板库进入一个模板。
2. 按模板数量要求，从 `assets/demo/inputs/` 选择图片。上传后可点击放大、替换或移除。
3. 点击“开始制作”，在右侧“历史素材”查看等待、处理中阶段及成功结果。点击成功图片可放大预览。
4. 连续点击“再次制作”创建多个任务，观察两个任务执行、其他任务等待，各任务独立更新。
5. 处理中刷新页面，记录会从 Java 恢复并继续更新。关闭页面不会中断后台任务。
6. 打开“我的素材”查看跨模板记录，切换分类筛选结果。“刷新记录”只读取已有任务，不重新制作。

### 指定阶段失败

启动应用并等待已有任务结束后，运行内置演示脚本：

```sh
docker compose --profile test run --rm --no-deps frontend-check node ../scripts/smoke.mjs
```

脚本使用“小禾”上传样例，创建三个成功任务及一个在“模拟生成”阶段失败的任务，并演示两线程执行、排队、退出后继续执行和身份隔离。随后在页面选择“小禾”，查看新增记录。

要指定其他阶段，在同一会话下先调用 `POST /api/session` 选择用户，再通过 `POST /api/assets` 上传图片，使用返回的素材 ID 调用 `POST /api/tasks`：

```json
{
  "templateId": "mountain-card",
  "assetIds": ["上传接口返回的素材 ID"],
  "simulation": {
    "stepDelayMs": 3000,
    "failAtStage": "MATERIAL_CHECK"
  }
}
```

`failAtStage` 可选 `MATERIAL_CHECK`、`MOCK_GENERATION`、`RESULT_FINALIZATION`；设为 `null` 表示成功流程。失败记录会显示对应阶段与原因。

### 调整耗时

在创建请求中设置 `simulation.stepDelayMs`，可调整该任务每阶段的耗时。省略 `simulation` 时使用后端默认值。

需要调整页面提交任务的默认耗时时，在 `.env` 设置 `SIMULATION_STEP_DELAY_MS=5000`。等待已有任务结束后执行 `docker compose up -d backend`，重新选择身份并提交任务，即可观察每阶段约 5 秒的处理过程。

## 用户身份与个人记录

演示用户为 `demo-alice`（小禾）和 `demo-bob`（阿远）。选择身份后，Java 创建服务端会话，空闲有效期为 30 分钟；Cookie 使用 HttpOnly、SameSite=Lax 和 Path=/。

上传素材和制作任务的归属由服务端会话确定，不接受客户端指定所有者。读取其他用户的素材、任务或结果统一返回 404。选择另一身份会废弃旧会话，页面同时清空当前上传表单和旧用户记录。

演示时，先用“小禾”完成制作，再切换“阿远”，页面不应显示“小禾”的记录；切回“小禾”后，其历史任务和结果仍然可见。未选择身份时点击上传区域，会提示选择身份。

保持 `DEMO_MODE=true` 进行演示；设为 `false` 会关闭演示身份及模拟参数入口，项目没有另一套登录入口。

## 构建、测试与 CI

在仓库根目录依次执行：

```sh
# Java 测试与构建，连接独立的临时测试数据库
docker compose --profile test run --rm backend-test

# 安装前端依赖，执行 lint、类型检查与生产构建
docker compose --profile test run --rm --no-deps frontend-check

# 构建浏览器测试所用后端镜像，执行浏览器与 HTTP 渲染测试
docker compose build backend
docker compose --profile browser run --rm browser-test
docker compose --profile browser run --rm --no-deps browser-test node --test tests/catalog-http.test.mjs
```

前端检查会重新安装依赖，运行前先停止使用同一目录的 `frontend-dev`。浏览器测试使用隔离的 Java、MySQL 和文件目录，不写入默认演示库。后端重点覆盖步骤顺序、失败中断、队列和所有权；前端重点覆盖多任务隔离、请求异常、查询生命周期、上传与历史恢复。

结束后停止并移除测试服务：

```sh
docker compose --profile test --profile browser stop mysql-test frontend-dev backend-browser mysql-browser
docker compose --profile test --profile browser rm -f mysql-test frontend-dev backend-browser mysql-browser
```

[GitHub Actions](.github/workflows/ci.yml) 在 push 或 pull request 时执行前端 lint、类型检查、构建及 Java 测试、构建，并执行浏览器、HTTP 渲染和 smoke 测试。验收 commit 的[运行结果](https://github.com/anwen0724/xiaoying/actions/runs/41589698488)已通过：18 项 Java、86 项浏览器、1 项 HTTP 渲染测试及 smoke。

## 完成情况与实际投入

已完成模板分类与详情、图片上传和前后端校验、三阶段异步制作、指定失败与耗时控制、多任务跟踪、请求异常恢复、个人历史和图片预览，以及桌面／小屏交互、CI 和 Compose 启动。

制作按题目要求使用延迟与预置图片模拟，不调用真实 AI。会话和执行队列保存在内存中；Java 服务重启后需要重新选择身份，重启前未结束的任务不会自动恢复执行，已完成记录及文件保留。文件与数据库不在同一事务中，进程中断可能留下未引用文件。

开发过程中没有单独记录人工工时，无法提供准确的实际投入时长。

## 部署与回滚

首次部署使用上文启动命令。更新前记录当前 Git commit，保存数据库和文件卷备份，等待正在执行的任务结束，然后在目标版本源码目录执行：

```sh
docker compose up -d --build --wait
docker compose ps
docker compose logs --tail 100 backend frontend
```

回滚时切换到更新前记录的 commit，执行相同构建启动命令，沿用现有数据卷。当前版本只有初始化 SQL，没有增量库表迁移；后续涉及库表变更时，需要同时处理数据兼容。

停止服务使用 `docker compose down`，该命令保留数据卷。不要使用 `down -v` 更新或回滚，它会删除持久化数据。

## AI 使用与代码、素材来源

使用 Codex 辅助开发。先将题目拆成模板、上传、后台任务、前端状态与交付等任务，提供原题、现有代码和编码规范作为上下文；明确接口和库表后生成或修改代码，再通过容器内测试、实际页面及 CI 检查结果，按失败原因修正实现或测试。

例如，会话测试暴露了中文用户种子的编码问题，补充 SQL 会话字符集后通过。后续上传交互改为“未选择身份时弹出提示”，CI 发现旧测试仍要求禁用上传框，于是按已确认交互修正断言，检查提示、焦点及禁止提交行为后通过。

后端基于已有的 `initialized-backend` 初始化模板，复用 Maven Wrapper、POM 构建组织及异常处理思路；业务包、依赖配置和响应契约按本项目调整。

模板照片来自 Unsplash，来源地址与许可见[素材说明](assets/demo/SOURCES.md)。照片已嵌入项目内的 SVG；SVG 排版、裁切和极简几何封面由本项目制作。
