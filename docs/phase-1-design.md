# 第一阶段：技术方案、数据与接口约定

> 本文自 2026-11-02 起保留为第一阶段历史快照，细项不再作为当前实现依据。当前设计分别维护在 [阶段二设计](phase-2-design.md)、[库表设计](database-design.md) 和 [接口文档](api.md)。下文保留当时的方案及验证记录，包括当时的 Maven 3.9.9 基线；当前版本及后续修订以阶段二设计为准。

日期：2026-11-02。依据：[需求与任务清单](requirements-and-task-list.md)、[原始题目](../timu.md)。

本文确定第二阶段的实现输入，不代表业务代码已经完成。用户已在会话中确认两项选择：**演示用户切换＋服务端会话**，以及 **2 个工作线程，超过后排队**。其余方案是本阶段采用的实现基线，可以在发现实际兼容问题时修订，并记录原因。

后续讨论确定：后端以用户提供的 `C:\all\work\study\initialized-backend` 为初始化来源，保留 MyBatis-Plus，并改用适配 Spring Boot 3 的 Starter。此前普通 MyBatis Starter 的选择由此替换；题目的技术要求和业务验收范围不变。

## 1. 当前状态和阶段结论

- 项目原有题目、4 张参考截图及需求清单，无业务代码；方案更新时已初始化本项目 Git 仓库，尚未创建提交。
- 本机已有 Java 21.0.10、Node.js 24.14.0、npm 11.9.0、Maven 3.9.9。
- Docker 客户端 29.7.2 已安装，当前无法连接 `desktop-linux` 引擎。第一阶段不依赖该引擎；实际容器构建、测试和运行仍待验证。
- 本阶段增加技术与接口约定、模板种子、原创示例素材和来源说明。
- 第一阶段通过标准是设计和素材准备完成。依赖声明兼容不等于构建或运行已通过。

## 2. 技术版本和启动约定

### 2.1 版本基线

| 组件 | 选定版本 | 说明 |
| --- | --- | --- |
| Node.js | 24.14.0 | 与当前本机版本一致；满足 Next.js 的 Node.js 要求 |
| npm | 11.9.0 | 使用 `package-lock.json`，CI 使用 `npm ci` |
| Next.js | 16.4.3 | App Router；`eslint-config-next` 使用同版本 |
| React / React DOM | 19.3.1 | 两者保持同版本 |
| TypeScript | 5.9.3 | 使用已核对的 5.9 版本，不为本题迁移新的语言主版本 |
| Java | 21 | 编译目标固定为 21；本机补丁版本为 21.0.10 |
| Maven | 3.9.9 | 后端构建工具；后续配置 Wrapper 和 CI |
| Spring Boot | 3.5.16 | Java 21 在官方兼容范围内 |
| MyBatis-Plus | 3.5.9 | 沿用模板版本，使用 `mybatis-plus-spring-boot3-starter`；实际依赖树、数据库映射及启动在阶段二验证 |
| MySQL | 8.4.13 | 8.4 LTS 系列，已查询官方镜像标签存在 |

数据库驱动和常规 Spring 依赖优先使用 Spring Boot 的依赖管理。前端使用 CSS Modules 和全局样式变量；服务端数据通过 TanStack Query 5 管理，上传槽位和提交状态使用组件状态。测试选用 JUnit 5／Mockito、Vitest／React Testing Library。辅助库精确版本在首次建立依赖文件时核对并锁定，不在此声明未验证的组合。

核对来源：

- [Next.js 安装要求](https://nextjs.org/docs/app/getting-started/installation)：Node.js 至少 20.9；构建不自动替代 lint。
- [Spring Boot 3.5 系统要求](https://docs.spring.io/spring-boot/3.5/system-requirements.html)：Java 21 和 Maven 3.9.9 在支持范围内。
- [MyBatis-Plus 官方安装说明](https://baomidou.com/getting-started/install/)：Boot 3 使用 `mybatis-plus-spring-boot3-starter`；不同时引入普通 MyBatis Starter。
- [MySQL 版本选择](https://dev.mysql.com/doc/refman/8.4/en/which-version.html)：8.4 是 LTS 系列。
- npm 包元数据已核对：[Next.js](https://registry.npmjs.org/next/16.4.3)、[React DOM](https://registry.npmjs.org/react-dom/19.3.1)、[TypeScript](https://registry.npmjs.org/typescript/5.9.3)、[ESLint 配置](https://registry.npmjs.org/eslint-config-next/16.4.3)。
- Maven Central 已核对：[Spring Boot](https://repo.maven.apache.org/maven2/org/springframework/boot/spring-boot-starter-parent/maven-metadata.xml)、[MyBatis-Plus Boot 3 Starter 3.5.9 POM](https://repo.maven.apache.org/maven2/com/baomidou/mybatis-plus-spring-boot3-starter/3.5.9/mybatis-plus-spring-boot3-starter-3.5.9.pom)。后者声明依赖 `mybatis-spring:3.0.4`；最终依赖解析和运行组合仍需验证。
- [MySQL 官方镜像标签](https://hub.docker.com/v2/repositories/library/mysql/tags?page_size=100&name=8.4)。

### 2.2 项目结构

以下是目标结构；本阶段只创建设计文档、种子和素材，不创建业务占位代码。

```text
frontend/                  Next.js 应用、组件和前端测试
backend/                   Spring Boot 应用及 Java 测试
database/                  MySQL 建表与演示用户初始化脚本
assets/demo/               模板种子、封面、预置结果、上传示例和来源说明
scripts/                   开发辅助脚本与素材准备脚本
docs/                      需求、技术方案和验收记录
.github/workflows/         CI
compose.yaml               前端、后端、MySQL 三个服务
.env.example               非敏感配置示例
README.md                  运行、演示、交付与取舍说明
```

后端按业务能力组织 `identity`、`template`、`asset`、`task`，在对应模块内放 Controller、Service、Mapper 和接口对象。任务模块统一管理状态转换、执行调度和结果整理，不建立通用工作流框架。

### 2.3 访问和启动方式

浏览器 → `http://localhost:3000` Next.js → Java `:8080` → MySQL `:3306`。

Next.js 将 `/api/*` 和 `/demo/*` 同源转发给 Java。业务校验、会话、文件访问和持久化全部由 Java 完成。采用 [Next.js rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)；Cookie 和上传请求是否完整转发是第二阶段的首个连通性验证项。

目标启动命令为 `docker compose up --build`。MySQL 通过健康检查后启动后端，前端等待后端可用。容器内部使用服务名 `backend`、`mysql`；浏览器不访问这些容器名。数据库结构由初始化脚本建立，Java 启动时读取模板种子并插入尚不存在的模板；不覆盖已有记录。

Java 将 `assets/demo` 中的模板和公开图像打包为 classpath 资源。Docker 构建上下文设为仓库根目录，避免构建时找不到共享素材。用户上传和任务结果写入独立数据卷，不写进源码目录。

规划配置：`JAVA_API_ORIGIN`、`DB_URL`、`DB_USERNAME`、`DB_PASSWORD`、`STORAGE_ROOT`、`DEMO_MODE`、`TASK_WORKERS=2`、`TASK_QUEUE_CAPACITY=32`、`SIMULATION_STEP_DELAY_MS=3000`。具体环境变量映射和可执行命令随实现进入 README。

### 2.4 后端模板复用约定

模板来源为 `C:\all\work\study\initialized-backend`，目标为本项目 `backend/`。原模板只作为复制来源；适配在本项目中完成。复制源码、必要 Maven 配置和 Wrapper，不复制 `.git`、`.idea`、`target`、`.env`。来源目录尚无验收 commit，README 记录来源及实际复用范围，不虚构上游版本。

| 内容 | 处理方式 | 性质 |
| --- | --- | --- |
| Spring Boot、Java、MySQL 工程骨架 | 复用；Boot 统一为本项目版本，包名、应用名、端口和扫描路径调整到本项目 | 工程适配；具体版本由项目选择 |
| MyBatis-Plus | 保留 3.5.9，更换为 Boot 3 Starter，不再额外引入普通 MyBatis Starter | 使用 Plus 是项目选择；Starter 调整是依赖兼容要求 |
| 异常处理和健康检查 | 复用组织方式，按第 7 节统一响应结构和 HTTP 状态码 | 本项目接口约定，不是题目强制格式 |
| CORS | 同源转发方案下不启用模板的任意来源携带 Cookie 配置 | 项目选型；题目允许直接跨域调用 Java，并未禁止 CORS |
| 配置 | 数据库连接通过环境变量提供；后端使用根 context path，接口由 Controller 映射 `/api`，公开资源保留 `/demo` | 支持本项目路由和容器启动 |
| 通用分页、删除、逻辑删除配置 | 不直接带入业务；历史按已约定的 cursor 查询，不增加删除功能 | 按实际需求选择复用范围 |
| Hutool、Knife4j、Lombok | 保留有明确用途且经验证兼容的依赖；模板复用代码需要 Lombok 时一并保留 | 可选工具，不属于题目要求 |
| Maven Wrapper | 复用 Wrapper 文件，版本与本项目 Maven 基线统一 | 构建一致性 |

题面要求 MyBatis，没有点名 MyBatis-Plus 或禁止其增强层。采用 Plus 是基于题面与用户讨论的项目决定，不表示获得了招聘方的额外确认。任务状态转换仍由业务服务明确组织，通用 CRUD 不能代替事务边界、用户归属检查和失败中断。

第一项验证是解析依赖、编译并启动最小后端，确认 Mapper 可注册且能对 MySQL 完成一次实际读写；通过后再扩展业务。若发现版本兼容问题，优先调整相关依赖并记录证据，不因使用模板而更改功能要求。

## 3. 重要方案选择

| 问题 | 采用方案 | 备选方案与取舍 |
| --- | --- | --- |
| 身份 | 两个预置演示用户＋Java 会话，用户已确认 | 账号密码登录需要额外登录校验，本题不要求注册体系 |
| 持久层 | 保留用户模板中的 MyBatis-Plus，使用 Boot 3 Starter | 替代此前普通 MyBatis Starter 方案；关键任务 SQL 按业务约束明确实现 |
| 浏览器请求 | Next.js 同源转发 | 直接跨域调用 Java 需要单独配置跨域与凭据传递；同源转发减少浏览器侧配置 |
| 后台执行 | 2 个固定工作线程＋32 个排队位置，用户确认线程数 | 单线程更简单，但两个工作线程便于同时观察独立任务进度；消息队列没有本题所需的额外收益 |
| 前端状态更新 | TanStack Query 管理请求缓存，2 秒轮询未完成任务 | SSE 可减少周期请求，但增加连接恢复和服务端推送生命周期；本题采用轮询 |
| 文件 | 本地目录／容器卷；Java 按归属提供私有文件 | 对象存储引入外部依赖，本题不需要 |
| 模拟输出 | 按模板复制预置 SVG 结果到任务专属目录 | 不真正合成上传图片；题目允许预置结果，页面和 README 需明确是模拟制作 |

主要实现风险是任务记录已提交、调度却失败，以及切换用户后旧响应覆盖新数据。前者通过明确的调度失败状态和测试处理；后者通过用户维度缓存、取消请求和响应归属检查处理。进程退出导致内存队列丢失属于已接受边界，不增加自动恢复机制。

## 4. 用户身份与记录归属

预置用户 `demo-alice`（小禾）和 `demo-bob`（阿远）。首次访问显示身份选择入口，不自动把历史记录归给某个默认用户；页面顶部可随时切换演示用户。

- Java 使用 `HttpSession`，Cookie 为 HttpOnly、SameSite=Lax、Path=/；本地 HTTP 演示不设置 Secure，HTTPS 部署时启用。
- 切换身份时废弃旧会话并创建新会话；正常刷新沿用现有会话。
- 任务和素材归属由服务端从会话读取，不接受客户端提交 `userId` 来指定所有者。
- 他人的任务、素材和结果按不可见处理，查询返回 404。
- 切换用户时前端暂停提交、取消旧查询和上传请求，清除上传槽位、旧任务缓存与错误，再加载新用户数据。
- 无法取消的已受理任务继续归属于原用户；切换用户不会改变任务归属。
- 请求发出时记录用户与本次页面会话标识；响应回来时不匹配则丢弃。多标签页共享 Cookie，在窗口重新获得焦点时重新确认当前身份。
- 会话过期时返回 401，前端停止任务查询并回到身份选择；重新选择原用户后能从 MySQL 恢复记录。

这是明确的演示身份机制，不声称提供真实账号认证。Java 重启后内存会话失效，用户重新选择身份即可查看仍在数据库中的历史记录。

## 5. 数据模型

ID 在 API 中均为字符串。业务 ID 使用 UUID，模板与演示用户使用稳定字符串 ID。时间存为 UTC，API 使用带 `Z` 的 ISO 8601，前端按用户本地时间显示。

| 表／对象 | 主要字段 | 约束与用途 |
| --- | --- | --- |
| `users` | `id`, `display_name`, `created_at` | 预置两个用户，不保存密码 |
| `templates` | `id`, `title`, `description`, `category`, `cover_path`, `required_image_count`, `accepted_mime_types`, `max_file_size_bytes`, `result_preset_path`, `sort_order` | 分类为稳定代码；种子导入数据库；预置结果路径不作为客户端可修改参数 |
| `assets` | `id`, `user_id`, `original_name`, `storage_path`, `mime_type`, `size_bytes`, `created_at` | 存储路径由服务端生成；文件写入成功后才返回可用素材 ID |
| `tasks` | `id`, `user_id`, `template_id`, `template_title`, `status`, `stage`, `version`, `failure_code`, `failure_reason`, `result_path`, `created_at`, `started_at`, `finished_at`, `simulation_config` | 保存模板标题快照、任务级模拟配置；`version` 随每次状态变更递增 |
| `task_inputs` | `task_id`, `asset_id`, `position` | 唯一约束 `(task_id, position)`；保留上传位顺序 |
| `task_steps` | `task_id`, `stage`, `position`, `status`, `started_at`, `finished_at`, `failure_reason` | 唯一约束 `(task_id, stage)`；保存每一步执行证据 |

索引至少覆盖 `tasks(user_id, created_at, id)` 和 `tasks(user_id, status)`。任务查询始终包含用户归属条件。具体 DDL 和索引执行效果在第二阶段验证。

素材移除／替换在本题中表示从待提交表单移除，不删除已被历史任务引用的文件。未被引用的上传文件暂不自动回收，作为已知限制记录；不增加文件清理后台。

## 6. 任务状态与后台执行

### 6.1 整体状态

```text
QUEUED → RUNNING → SUCCEEDED
   │         └──→ FAILED
   └────────────→ FAILED（调度未成功）
```

`SUCCEEDED` 和 `FAILED` 为终态，不允许查询、重复回调或迟到响应将其改回处理中。

处理阶段按固定顺序执行：

1. `MATERIAL_CHECK`：检查素材归属、文件可读及与模板要求一致。
2. `MOCK_GENERATION`：按配置延迟，选择预置结果，不调用真实 AI。
3. `RESULT_FINALIZATION`：复制预置结果到该任务目录，验证结果可访问后保存成功状态。

排队时 `stage=null`。处理时指向当前步骤，成功时保留 `RESULT_FINALIZATION`，阶段失败时保留失败阶段；调度失败时仍为 `null`。页面不能仅根据 `stage` 推断整体状态。

每一步的状态为 `PENDING`、`RUNNING`、`SUCCEEDED`、`FAILED`、`SKIPPED`。失败阶段之后的步骤标记为 `SKIPPED`，且不执行其业务逻辑。

### 6.2 提交流程与事务边界

1. 同步验证身份、模板、素材数量／顺序／所有者／实际类型／大小，以及模拟参数范围。
2. 在短事务中创建 `QUEUED` 任务、输入关联和三个 `PENDING` 步骤；事务提交后才调度。
3. 将任务 ID 提交到固定线程池。HTTP 返回 `202 Accepted` 和任务快照，不等待三阶段完成。
4. 工作线程按阶段更新任务和步骤记录，每次变更使用独立短事务；延迟、文件读取和复制不占用长数据库事务。
5. 每一步开始及结束均持久化，只有全部完成且结果文件可读才写入 `SUCCEEDED`。
6. 任一步抛出异常，记录失败阶段、错误代码和可理解原因，跳过后续步骤。

线程池采用 2 个固定线程、32 个队列位置和明确拒绝策略，不使用在 HTTP 请求线程执行任务的回退策略。队列满时，已创建任务写为 `FAILED / EXECUTOR_CAPACITY_EXCEEDED`，三个步骤标记跳过，仍返回其任务 ID，避免留下无人处理的等待记录。受理响应可能早于下一次状态更新，前端按任务 `version` 合并后续结果。

数据库故障可能阻止失败状态写入；实现需记录日志，不宣称此方案提供跨进程可靠投递或故障恢复。服务重启后不自动重排 `QUEUED` 或 `RUNNING` 记录，README 明确这一限制。

### 6.3 模拟参数

默认每一步延迟 3000 ms，即单个成功任务约 9 秒，不含排队时间。

开发环境创建任务时允许携带：

```json
{
  "simulation": {
    "stepDelayMs": 3000,
    "failAtStage": "MOCK_GENERATION"
  }
}
```

`stepDelayMs` 为 0–30000 的整数，`failAtStage` 为三个阶段之一或 `null`。未提供时采用服务端默认值。实际配置在任务创建时快照保存，不使用影响所有运行任务的全局可变开关。指定失败在该阶段开始并完成配置延迟后触发，便于观察失败前状态。

仅 `DEMO_MODE=true` 接受覆盖参数；关闭时携带此字段返回 400。正式制作界面不增加模拟控制面板；README 用 HTTP 请求示例演示。

## 7. HTTP 接口约定

### 7.1 通用规则

- API 前缀 `/api`，JSON 使用 camelCase。
- 非列表成功响应直接返回对象；列表返回 `{ "items": [] }`，需要翻页时附 `nextCursor`。
- 错误返回 `{ "code": "...", "message": "...", "fieldErrors": {} }`；无字段错误时省略 `fieldErrors`。
- 常用状态码：400 参数无效，401 未选择身份／会话过期，404 不存在或不属于当前用户，413 上传过大，415 不支持的文件类型，500／503 服务异常。
- 用户相关响应使用 `Cache-Control: no-store`，前端不从 Next.js 静态缓存恢复个人任务。
- 上传服务端检查实际图片内容，不只相信扩展名或客户端 MIME。仅接受 JPEG、PNG，单张不超过 5 MiB。
- 上传失败不创建可提交的素材 ID；完成上传后才计入准备好的素材数量。

### 7.2 接口清单

| 方法与路径 | 请求 | 响应与行为 |
| --- | --- | --- |
| `GET /api/demo-users` | 无 | 演示用户 `id`、`displayName` 列表 |
| `POST /api/session` | `{ "userId": "demo-alice" }` | 选择／切换合法演示用户，返回用户对象并设置会话 Cookie |
| `GET /api/session` | 无 | 当前用户对象；无会话返回 401 |
| `DELETE /api/session` | 无 | 退出会话，204 |
| `GET /api/categories` | 无 | `code`、`name` 列表；分类从模板种子及模板数据得到 |
| `GET /api/templates?category=travel` | 分类可选 | 模板列表；空分类结果返回空列表 |
| `GET /api/templates/{id}` | 无 | 模板详情；不存在返回 404 |
| `POST /api/assets` | multipart：`file`、`templateId` | 201；返回 `id`、`originalName`、`mimeType`、`sizeBytes`、`previewUrl` |
| `GET /api/assets/{id}/content` | 无 | 当前用户的素材二进制，用于服务端预览 |
| `POST /api/tasks` | `templateId`、有序 `assetIds`、可选 `simulation` | 202；返回任务快照和 `Location: /api/tasks/{id}` |
| `GET /api/tasks/{id}` | 无 | 任务快照及步骤明细；只读取记录 |
| `GET /api/tasks?limit=20&cursor=...` | limit 为 1–100，cursor 可选 | 当前用户历史，按创建时间和 ID 倒序；返回 `items` 和 `nextCursor` |
| `GET /api/tasks/active` | 无 | 当前用户全部 `QUEUED`、`RUNNING` 任务；用于刷新后恢复，不受历史分页限制 |
| `GET /api/tasks/status?ids=id1,id2` | 最多 100 个不同任务 ID | 返回指定任务最新快照，包括刚进入终态的任务；另返回 `missingIds`，不暴露他人数据 |
| `GET /api/tasks/{id}/result` | 无 | 当前用户成功任务的结果图片；未成功返回 409，其他用户返回 404 |
| `GET /demo/{path}` | 无 | 随应用打包的公开封面及预置图像；只从固定资源目录读取 |

静态路径 `active`、`status` 与任务 ID 路由明确区分。历史 cursor 编码上一条的 `createdAt` 和 `id`，避免只按时间排序时相同时间记录重复或遗漏。

创建任务时 `assetIds` 必须与模板要求数量完全一致，且 ID 不重复、均属于当前用户。上传时的模板检查用于即时反馈；提交时仍按当前目标模板重新检查，不依赖浏览器校验结果。

### 7.3 模板对象

```json
{
  "id": "travel-duo",
  "title": "海边双拼",
  "category": "travel",
  "categoryName": "旅行记忆",
  "description": "上传两张图片，模拟制作一张双图旅行卡片。",
  "coverUrl": "/demo/covers/travel-duo.svg",
  "requiredImageCount": 2,
  "acceptedMimeTypes": ["image/jpeg", "image/png"],
  "maxFileSizeBytes": 5242880
}
```

### 7.4 创建任务与任务对象

```json
{
  "templateId": "travel-duo",
  "assetIds": ["asset-uuid-1", "asset-uuid-2"]
}
```

```json
{
  "id": "task-uuid",
  "templateId": "travel-duo",
  "templateTitle": "海边双拼",
  "status": "RUNNING",
  "stage": "MOCK_GENERATION",
  "version": 3,
  "createdAt": "2026-11-02T06:00:00Z",
  "startedAt": "2026-11-02T06:00:00Z",
  "finishedAt": null,
  "resultUrl": null,
  "failure": null
}
```

失败时 `failure` 为 `{ "code": "SIMULATED_FAILURE", "stage": "MOCK_GENERATION", "message": "模拟生成阶段按演示配置失败" }`。调度失败的 `stage` 为 `null`。成功时 `resultUrl` 为 `/api/tasks/{id}/result`；失败和未完成任务不提供结果地址。

详情接口额外提供 `steps`，每项包含 `stage`、`status`、`startedAt`、`finishedAt`、`failureReason`。批量查询和历史列表不必返回步骤明细。

## 8. 前端页面与状态约定

路由规划：`/` 为模板列表，`/templates/[id]` 为左侧制作、右侧历史的主要操作页，`/history` 为个人全部历史。制作页右侧按当前模板筛选显示，但刷新恢复时仍获取当前用户全部未完成任务，避免遗漏其他模板任务。

状态分成三类：

- 上传槽位：`empty / uploading / ready / error`，只属于对应上传位；替换时使旧上传响应失效。
- 提交请求：`idle / submitting / error`；202 返回后退出 submitting 并将任务加入记录。成功受理后清空本次上传选择，允许继续制作。
- 后台任务：只采用服务端的 `status`、`stage`、`version`、`failure`、`resultUrl`。查询错误另存，不写入任务的 `failure`。

身份确认后并行读取历史首屏和全部未完成任务，将任务按 ID 合并。缓存键包含用户 ID。每 2 秒对已知未完成 ID 进行一次批量查询；每批最多 100 个，避免请求重叠。合并时拒绝较小 `version` 的旧快照。

终态任务移出待查询集合。集合为空时不启动定时查询。批量查询失败时保留已有状态，暂停自动轮询并展示“状态暂时无法更新”和重试按钮；重试成功后恢复跟踪。401 则结束当前身份状态。

请求返回的 `missingIds` 从待跟踪集合移除并提示记录不可访问，不能标记为执行失败。页面卸载时取消请求和定时器；页面重新进入时重新读取后端状态。

## 9. 模板与素材准备

种子文件：[templates.json](../assets/demo/templates.json)。素材来源与用途见 [素材说明](../assets/demo/README.md)。

| ID | 模板 | 分类 | 图片数量 |
| --- | --- | --- | --- |
| `mountain-card` | 山野明信片 | 旅行记忆 `travel` | 1 |
| `travel-duo` | 海边双拼 | 旅行记忆 `travel` | 2 |
| `minimal-cover` | 极简封面 | 创意设计 `design` | 1 |
| `inspiration-grid` | 三格灵感板 | 创意设计 `design` | 3 |

所有模板接受 JPEG、PNG，单文件最大 5242880 字节。封面和结果采用本地原创 SVG 几何插画；上传示例提供实际 PNG／JPEG 文件。SVG 是可信的内置展示资源，不属于用户上传白名单。

素材不依赖网络或付费服务。预置结果只用于模拟，不承诺反映用户上传图片。最终界面视觉优化属于后续阶段，本阶段素材用于证明数据和文件链路可实施。

## 10. 第二阶段的首个验证与已知边界

先完成一个最小连通性验证：通过 Next.js 入口选择演示用户 → Java 会话生效 → 上传一张示例图 → MySQL 保存素材归属 → 刷新后仍可读取当前用户与素材。这个验证通过后再扩展三阶段任务。

随后验证三个关键场景：

1. 提交三个延迟任务，前两个处理、第三个排队；关闭页面仍执行，重新进入后读取结果。
2. 分别指定三个阶段失败，确认后续步骤没有执行，查询不改变终态。
3. 切换用户并人为延迟旧请求，确认旧响应不覆盖新用户记录；刷新可恢复各自历史。

当前未执行依赖安装、构建、数据库初始化、容器运行或业务测试。容器引擎不可用是后续运行验证的前置问题；不影响本阶段文档和素材准备结论。

已接受限制：单实例进程内执行、不自动恢复重启后的任务、不自动重试失败任务、不实现提交幂等、不自动清理未引用素材、演示身份不提供真实账号认证。相关限制必须进入最终 README。
