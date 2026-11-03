# 素材制作网站

阶段二至五已完成，阶段六的 CI 配置与本地容器验证已完成。后台提供 Java 接口、MySQL 持久化和三阶段任务执行；页面支持模板浏览、演示身份、图片上传、多任务跟踪、个人历史和结果预览。GitHub 托管运行未验证；阶段七保持暂停，尚未完成当前版本的最终交付验收。

[阶段四设计](docs/phase-4-design.md) 记录左右分区、个人全部历史、多任务跟踪、查询故障与恢复规则，以及执行证据。

[阶段五设计](docs/phase-5-design.md) 记录上传与恢复焦点、空状态判定、页面加载、三轮固定版式比较和验收；[Taste 评审](docs/phase-5-ui-review.md) 只记录对齐、对比、层级与间距。

[阶段六设计](docs/phase-6-design.md) 记录流水线分工、核心场景覆盖、容器验证和远程运行限制。

首次 Git 提交建立当前交付基线：阶段二、三源码与测试、阶段四设计及题目参考材料。环境文件、依赖目录、构建缓存、运行数据、测试截图和日志不纳入版本控制；`.env.example` 仅含本地演示值。首次提交不代表整道题目已经完成。

## 启动

需要可用的 Docker Engine 和 Docker Compose。在仓库根目录执行：

```sh
docker compose up -d --build --wait
```

打开 <http://localhost:3000>。前端发布 3000 端口；Java 8080 和 MySQL 3306 仅在 Compose 网络内开放。Next.js 将 `/api/*`、`/demo/*` 转发到 Java，不执行制作任务。

端口被占用时，在 `.env` 中设置 `FRONTEND_PORT` 后启动；例如 3001 对应 `http://localhost:3001`。

第一次启动会执行 `database/init/001-schema.sql` 和 `002-demo-users.sql`。Java 随后导入缺少的模板并检查预置文件。重复启动不会覆盖已有模板。MySQL 数据保存在 `mysql-data`，上传及结果保存在 `file-data`。

查看与停止：

```sh
docker compose ps
docker compose logs --tail 100 backend frontend
docker compose down
```

`down` 保留数据卷。不要用 `down -v` 作为更新步骤，该参数会删除持久化数据。

## 技术与结构

| 部分 | 版本 |
| --- | --- |
| Java／Maven Wrapper | 21／3.9.14；本次容器实际 Java 21.0.13 |
| Spring Boot／MyBatis-Plus | 3.5.16／3.5.9，Boot 3 Starter |
| MySQL | 8.4.13 |
| Node.js／npm | 24.14.0／11.9.0 |
| Next.js／React | 16.4.3／19.3.1 |
| TypeScript／ESLint | 5.9.3／9.39.5 |
| TanStack Query | 5.105.1 |
| Playwright 测试库／浏览器镜像 | 1.64.1／v1.64.1-noble |

前端精确依赖由 `frontend/package-lock.json` 固定。后端由 POM、Boot 依赖管理和 Wrapper 固定版本。镜像 digest 与验收证据见[阶段二设计](docs/phase-2-design.md)。

```text
frontend/                  Next.js App Router、业务页面、同源转发
  src/app/                 模板库、制作页、个人历史、加载及错误入口
  src/features/            templates、identity、creation、tasks
  src/shared/              HTTP 边界解析与共享错误组件
  tests/                   浏览器行为与 HTTP 渲染验证
backend/                   Java 工程，Service 接口与实现分离
  src/main/java/com/anwen/xiaoying/
    identity/              演示身份与会话
    template/              模板、分类与种子
    asset/                 上传、图片校验与私有文件
    task/                  受理、执行、查询与状态事务
    common/                错误响应与共享校验
    config/                线程池、配置与 JSON 协议
database/init/             六表结构与用户种子
assets/demo/               四个模板、预置 SVG 和上传样例
scripts/smoke.mjs          容器内 HTTP 场景验证
docs/                      持续维护的设计、库表、接口和任务清单
```

## 配置

Compose 提供本地演示默认值，无需真实凭据。需要修改时，将 `.env.example` 复制为 `.env`；不要将 `.env` 加入 Git。

| 配置 | 默认值／说明 |
| --- | --- |
| `FRONTEND_PORT` | `3000`，宿主机前端入口端口 |
| `DB_PASSWORD` | `local-demo-password`，应用数据库账号密码 |
| `MYSQL_ROOT_PASSWORD` | `local-demo-root`，仅用于数据库初始化 |
| `DEMO_MODE` | `true`，启用演示身份与按任务指定的模拟参数 |
| `TASK_WORKERS` | `2`，正整数 |
| `TASK_QUEUE_CAPACITY` | `32`，正整数，不包含正在执行的任务 |
| `SIMULATION_STEP_DELAY_MS` | `3000`，每阶段毫秒数，范围 0–30000 |
| `DB_URL`／`DB_USERNAME` | Compose 配置为 MySQL 服务地址和 `xiaoying` 账号 |
| `STORAGE_ROOT` | Compose 配置为 `/app/data` |
| `JAVA_API_ORIGIN` | Next.js 构建环境读取；默认 `http://backend:8080` |

修改 Next.js 转发目标需要设置构建环境并重新构建，单独修改运行容器的变量不会更新已有 rewrites。现有 Compose 固定使用默认服务名。

MySQL 的账号初始化变量仅在空数据卷生效。已有库修改密码时，应同步修改数据库账号，不能只改 `.env`。

## 身份、接口与后台任务

`demo-alice`（小禾）与 `demo-bob`（阿远）通过 `POST /api/session` 选择身份。Java 使用有效期为 30 分钟的空闲会话，Cookie 为 HttpOnly、SameSite=Lax、Path=/。选择另一个身份会废弃旧会话。素材及任务所有者由服务端会话确定；不可见记录统一返回 404。

所有请求响应、校验规则和错误码见[接口文档](docs/api.md)，字段和约束见[库表设计](docs/database-design.md)。主要路径为：

| 路径 | 用途 |
| --- | --- |
| `/api/health`、`/api/demo-users`、`/api/session` | 就绪检查与身份 |
| `/api/categories`、`/api/templates` | 分类及模板要求 |
| `POST /api/assets` | 上传一张 JPEG／PNG，检查真实内容与大小 |
| `POST /api/tasks` | 受理并返回 202、任务 ID 和 Location |
| `/api/tasks/{id}`、`/api/tasks` | 任务详情、按模板筛选的个人历史 |
| `/api/tasks/active`、`/api/tasks/status` | 全部未完成任务、指定 ID 的最新状态 |
| `/api/tasks/{id}/result` | 本人成功任务的 SVG 结果 |

任务按 `MATERIAL_CHECK → MOCK_GENERATION → RESULT_FINALIZATION` 执行，状态为 `QUEUED → RUNNING → SUCCEEDED/FAILED`。两个工作线程并行执行，其他任务排队；队列满时将新登记任务记录为调度失败。HTTP 请求线程不执行制作。

每个阶段等待配置的耗时。素材检查再次验证输入；模拟生成读取预置 SVG；结果整理将结果副本保存至私有目录。阶段失败后，后续步骤标记为 SKIPPED。短事务一起更新任务和步骤，递增 version。查询不推进执行，终态不因结果文件读取失败而回退。

### 演示方法

浏览器打开首页，先选择页顶的演示身份，再选择一个模板。按要求上传 1／2／3 张图片，点击“开始制作”。可以使用 `assets/demo/inputs/` 中的样例。

上传区使用一个添加入口和已选图片网格，支持一次多选、点击放大预览、替换、移除和失败重试。提交后展示任务 ID，并立即将任务加入右侧“历史素材”。点击“再次制作”可用当前素材创建另一个任务，各任务的状态与结果独立更新。网络异常或回执无法解析时，页面说明任务可能已创建，不自动重发；可以点击“刷新记录”核对。

列表封面和详情示例图读取失败时，在原图片区域显示“封面加载失败”和“重新加载封面”。重试只重新请求该图片，不刷新整页、不创建任务；失败不阻止进入模板或使用上传表单。成功结果与上传图片支持放大预览、Esc／背景／关闭按钮关闭及焦点返回。卡片直接显示状态、阶段和失败原因，不再提供“任务详情”折叠区。

切换用户、退出身份或离开模板页会清空当前表单；再次进入需要重新上传。刷新后，身份会话、历史及未完成任务从 Java 恢复；素材与回执不做浏览器持久化。刷新不会重新创建任务，也不会撤销已经受理的后台执行。

点击导航“我的素材”进入 `/history`，查看当前用户各模板的制作任务和结果；这里不是上传原图的独立管理库。页面支持“全部／创意设计／旅行记忆”分类，URL 保留选择。制作页“历史素材”只展示当前模板记录。每页 20 条，滚动到底自动加载更早记录，不再显示“加载更多”按钮；刷新只重新读取后端记录，不会重新制作。刷新成功后重建分页列表，并保留本页新受理任务。切换用户后，旧记录、图片和查询错误不带入新用户页面。

未完成任务在上一轮查询结束约 2 秒后继续查询，每批最多 100 个 ID；成功、失败和不可访问记录停止跟踪。离开页面或隐藏页面后暂停新一轮查询，后台继续执行。页面重新可见时先确认身份，再恢复未完成任务的查询。

状态接口出错时，页面保留上次确认的状态，显示“状态暂时无法更新”并暂停自动查询。网络恢复后点击“恢复查询”。这不表示任务执行失败。成功任务的图片读取失败时，点击“重新加载图片”，任务仍保持成功。

接口文档第 8 节提供 PowerShell 请求示例。容器内可执行完整示例：

```sh
docker compose --profile test run --rm --no-deps frontend-check node ../scripts/smoke.mjs
```

该脚本创建三个耗时任务和一个指定阶段失败的任务。它验证上传、两线程并发、排队、退出会话后继续执行、用户隔离和结果读取。脚本会向演示账号新增记录，并写入被 Git 忽略的 `artifacts/smoke.json`。

手动创建任务时，可省略 simulation 使用默认配置，也可传入：

```json
{
  "templateId": "mountain-card",
  "assetIds": ["替换为上传接口返回的素材 ID"],
  "simulation": {
    "stepDelayMs": 3000,
    "failAtStage": "MOCK_GENERATION"
  }
}
```

成功演示将 failAtStage 改为 null。分别传入三个阶段名可复现不同失败点。延长 stepDelayMs 后连续创建三个任务，可观察两个执行、一个等待。退出会话后重新选择原用户，再查询历史即可看到后台结果。

可在一个模板连续创建三个任务，观察两个处理、一个等待；完成后刷新页面核对记录。进入“我的素材”查看其他模板的结果，再切换为另一个演示用户检查个人记录隔离。后台耗时和失败点仍通过 simulation 或配置控制，页面没有新增模拟参数面板。

## 构建与测试

安装、构建、测试和应用执行都在容器内完成：

```sh
docker compose --profile test run --rm backend-test
docker compose --profile test run --rm --no-deps frontend-check
docker compose build
```

`backend-test` 使用独立 MySQL 服务 `mysql-test`，其数据目录是 tmpfs，不连接业务库。测试保留真实 Mapper、事务和执行逻辑，只在时间边界使用事件闸门或固定时钟。后端测试覆盖成功、三个失败点、队列溢出、归属、分类筛选、同时间分页、JSON 校验、数据库约束及结果文件缺失。

结束后清理测试数据库容器：

```sh
docker compose --profile test stop mysql-test
docker compose --profile test rm -f mysql-test
```

不要在同一个测试数据库上并行启动多个测试进程。前端检查执行 npm ci、ESLint、TypeScript 和 Next.js 生产构建。运行该检查前先停止 `frontend-dev`，避免 npm ci 删除开发服务正在使用的依赖。

前端使用 Playwright 浏览器测试和 HTTP 渲染测试。先完成上述前端依赖安装，并构建后端镜像，再执行：

```sh
docker compose build backend
docker compose --profile browser run --rm browser-test
docker compose --profile browser run --rm --no-deps browser-test node --test tests/catalog-http.test.mjs
```

浏览器流程连接隔离的 `backend-browser` 与 `mysql-browser`，数据库和上传目录均使用 tmpfs，不写入演示库。测试覆盖 1／2／3 张素材、受理回执、重复提交保护、文件校验及提交不确定状态。阶段四新增多任务成功／失败／排队、历史恢复、分页竞争和身份隔离。查询测试覆盖终态停询、慢请求不重叠、可见性暂停，以及查询与图片重试。

阶段五补充上传要求关联、重试与移除后的焦点、未完成任务恢复期间的空状态，以及小屏多图和长文件名操作。固定视觉场景覆盖 1440／768／390px 的模板库、制作页、个人历史、空历史和读取失败；截图和测量写入被 Git 忽略的 `artifacts/phase-5/`。

上传、创建、多任务执行、跨模板历史和刷新恢复使用真实 Java／MySQL。网络边界替身用于故障、乱序、超过一批和分页边界；受控浏览器时钟用于验证停询。1440、768、390 像素真实提交截图输出至 `artifacts/phase-5/live/`。该视觉测试固定两条历史样例以保持截图可读，新增提交仍由 Java 执行。

测试开发服务使用 Webpack 文件轮询来适配 Windows 目录挂载。浏览器镜像与测试库版本一致，镜像自带的 Node／npm 仅运行测试，不作为应用版本基线。

结束后清理隔离浏览器服务及临时数据：

```sh
docker compose --profile browser stop frontend-dev backend-browser mysql-browser
docker compose --profile browser rm -f frontend-dev backend-browser mysql-browser
```

阶段六记录的 `npm audit --omit=dev` 为 0 项；当时完整 audit 报告 16 项中危项，来自开发工具链的 minimatch 依赖及其影响链。ESLint 9.39.5 当时还报告停止维护提示。当前保留已确认的直接版本；这些是阶段六检查结果，不是本次重新审计结果。

## 持续集成

[CI 工作流](.github/workflows/ci.yml) 在 push、pull request 时运行，也支持 Actions 页手动触发。两个作业分别执行 Java 测试与构建、前端检查与浏览器回归。所有项目安装、构建、测试和运行均在容器内完成；不需要仓库 Secret 或外部服务账号。

Java 作业执行 Maven verify，并连接临时 MySQL。前端作业先执行 npm ci、lint、类型检查和生产构建，再构建 Java 镜像，启动隔离浏览器服务，依次执行 Playwright、HTTP 渲染和 smoke。检查失败会使作业失败；浏览器测试不自动重试，也不接受 test.only。报告和服务日志保留 7 天，成功或失败后均安排清理临时服务与卷。

工作流使用独立 Compose 项目 `xiaoying-ci`。在本地复现时，可按工作流顺序执行其 Docker 命令，并为每条 Compose 命令增加 `-p xiaoying-ci`。先停止使用本工作区依赖的 `frontend-dev`，再运行 npm ci；不要同时运行两个浏览器测试进程。完成后，仅清理该隔离项目：

```sh
docker compose -p xiaoying-ci --profile test --profile browser down --volumes --remove-orphans
```

阶段六当时通过 actionlint、Compose 检查、16 项 Java 测试、43 项浏览器测试、1 项 HTTP 渲染测试、smoke 及前后端构建，并核对 smoke 任务的 MySQL 记录。失败退出、JUnit 报告和隔离环境清理也已验证。后续分类与 UI 修改按影响范围验证，证据见 [UI 修订记录](docs/ui-reference-revision.md)；上述数量不是当前测试总数，也不代表当前版本已完成全量回归或最终验收。

当前未配置远程仓库。GitHub 托管 runner 的事件触发、检出和报告上传未验证；本地容器结果不能记为 GitHub Actions 已通过。阶段六的实际检查结果见[验证记录](docs/phase-6-design.md#6-验证记录)。

## 更新与回滚

本次只有首次初始化脚本，没有增量结构变更。部署新代码前保存当前源码版本和镜像标识，再执行 `docker compose up -d --build --wait`。数据卷持续复用。

没有库表变更时，回到已验证的源码版本并重新构建，即可回滚应用。存在结构变更时，先依据 `database/migrations/` 中对应脚本评估数据兼容和逆向迁移，再回滚代码；不能用删除数据卷代替回滚。

验证容器重建后的持久化：先执行 smoke 脚本，再执行以下命令。该过程会结束会话，应避开正在执行的任务。

```sh
docker compose up -d --force-recreate --wait mysql backend frontend
docker compose --profile test run --rm --no-deps frontend-check node ../scripts/smoke.mjs --verify-persistence
```

## 独立交付验收

正式构建验收入口为 `frontend/playwright.acceptance.config.ts`。它使用真实 Java／MySQL，要求初始任务为空，会创建演示任务；应在源码副本与新数据卷中运行。不要指向已有业务环境。

在新解压的源码目录中，将 `.env.example` 复制为 `.env`，把 `FRONTEND_PORT` 改为未占用端口（例如 3001），然后执行：

```sh
docker compose -p xiaoying-acceptance build --no-cache
docker compose -p xiaoying-acceptance up -d --wait
docker compose -p xiaoying-acceptance --profile test run --rm --no-deps frontend-check npm ci
docker compose -p xiaoying-acceptance --profile browser run --rm --no-deps -e PLAYWRIGHT_BASE_URL=http://frontend:3000 browser-test npm test -- --config playwright.acceptance.config.ts
docker compose -p xiaoying-acceptance --profile test run --rm --no-deps frontend-check node ../scripts/smoke.mjs
docker compose -p xiaoying-acceptance up -d --force-recreate --wait
docker compose -p xiaoying-acceptance --profile test run --rm --no-deps frontend-check node ../scripts/smoke.mjs --verify-persistence
```

命令不启动 frontend-dev。正式页面验证分类、1／2／3 图提交、三阶段失败、多任务、刷新和用户隔离。证据写入 `artifacts/phase-7/` 和 `artifacts/smoke.json`。基础镜像和依赖下载缓存可复用；`--no-cache` 不复用应用构建层。

保存验收证据后，可删除本次独立环境的数据卷：

```sh
docker compose -p xiaoying-acceptance --profile test --profile browser down --volumes --remove-orphans
```

该清理命令只用于独立验收项目，不用于保留演示数据的默认项目。

## 完成范围与限制

阶段二基础服务、阶段三制作入口、阶段四多任务跟踪与历史、阶段五页面可用性与定点 UI 优化已实现。阶段六已交付 CI 配置并完成本地容器验证，GitHub 托管运行尚未验证。阶段七最终交付验收待完成，详见[任务清单](docs/requirements-and-task-list.md)。

当前只运行一个 Java 实例。会话和执行器队列在内存中；重启后会话失效，原有非终态任务不会恢复执行。历史及已有文件保留。未实现提交幂等、自动重试、任务取消、素材清理、账号注册或真实图片合成。文件与 MySQL 没有分布式事务，进程崩溃可能留下未引用文件。

演示身份适用于本题演示；`DEMO_MODE=false` 会关闭身份选择和模拟参数入口，项目不提供另一套登录流程。

## 来源、AI 工作流与投入

后端基于用户提供的 `C:\all\work\study\initialized-backend`。复用 Maven Wrapper、POM 构建组织与异常处理思路，改为本项目包名、依赖、配置和响应契约；原目录未修改。来源没有 commit，因此不填来源版本号。没有复制本地凭据、IDE 文件或原构建产物。

当前 UI 按原题主要布局修订，并按用户确认采用浅色主题：雾蓝灰背景、暖白面板、石墨灰文字与深雾岛蓝操作。保持紧凑图片列表、左侧完整制作面板、右侧统一结果卡片，以及轻量悬停、按压和处理中动画，支持减少动态效果。模板摄影已本地嵌入 SVG，来源及许可见 [素材说明](assets/demo/SOURCES.md)，上传样例保持不变。

阶段五原定稿存在参考布局落实不足的问题，其结论已由本轮 [UI 修订记录](docs/ui-reference-revision.md) 更新。本轮仍按功能初稿、Taste 四类评审、Impeccable 定点修改和三轮固定版式比较执行。阶段七保持暂停，不继续独立交付验收或打包。

使用 Codex 辅助开发。先从题目拆阶段，由用户确定身份、线程数、模板复用和编码规则，再维护设计、库表及接口三份文档。实现时按行为编写失败测试，再增加业务代码，在真实 MySQL 和容器中验证。例如，会话测试先暴露中文种子编码错误，修复 SQL 会话字符集后通过；请求类型测试发现数字被转换成字符串，修复 Jackson 转换规则后通过。验收结果同步至文档。

阶段二执行时间与证据记录在阶段二设计第 11 节。人工投入未单独计时，不将自动执行跨度写成人工工时。
