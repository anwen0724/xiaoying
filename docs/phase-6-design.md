# 阶段六设计：自动化验证与 CI

状态：2026-11-02 实施与本地容器验证完成；GitHub 托管运行尚未验证。基线为阶段五提交 `1b96fb8`。

## 1. 目标与执行判断

执行判断：Go。范围已确认，已有 Compose 与行为测试可复用。

本阶段属于工程质量交付。以原题 R-12 为主要依据：提供 push／pull request 触发的前端 lint、类型检查、构建，以及 Java 测试和构建。把现有浏览器测试接入 CI 是本项目的验证取舍，不是题目强制要求。

完成判据：工作流配置检查通过；与 CI 相同的容器命令通过；核心场景有测试或运行证据；失败检查返回非零退出码；报告与清理步骤明确。Agent 汇总证据，最终需求验收由用户决定。没有远程仓库时，仅报告本地命令验证，不宣称 GitHub 托管作业已运行。

## 2. 当前状态与边界

已有 16 项 Java 测试、43 项浏览器测试和 1 项 HTTP 渲染测试，以及 HTTP smoke 脚本。Java 测试使用真实 MySQL、Mapper 与事务；浏览器测试连接隔离 Java／MySQL。工作区干净，没有 `.github/workflows` 和 Git remote。

本阶段修改工作流、必要的测试配置和说明文档。保留业务行为、UI、依赖基线、接口和六表结构；只有验证暴露需求缺陷时才修复对应代码。不增加覆盖率门槛、多浏览器矩阵、自动发布或部署。全新交付环境与最终验收版本整理留到阶段七。

## 3. 流水线与版本取舍

使用 `.github/workflows/ci.yml`，监听 push、pull_request，并提供 workflow_dispatch 手动入口。默认只授予 contents: read，检出后不保留 Git 凭据。同一分支／PR 的新运行取消旧运行。

两个作业在独立 Ubuntu 24.04 runner 上执行：

| 作业 | 顺序 | 产物 |
| --- | --- | --- |
| backend | Compose 配置检查 → 隔离 MySQL → Maven verify | Surefire 报告、构建与数据库日志 |
| frontend | npm ci／lint／typecheck／build → 构建 Java 镜像 → 启动浏览器隔离服务 → Playwright → HTTP 渲染 → smoke | JUnit、失败截图／trace、固定场景截图、服务日志、smoke 证据 |

安装、编译、测试和应用执行均在容器内。runner 只负责 Git 检出、Docker 编排与报告上传。前端安装结束后才启动开发服务，避免 npm ci 移除运行中的依赖。两个作业不共享工作区、数据库或缓存卷。

沿用 Compose 中的 Node 24.14.0、Java 21、MySQL 8.4.13 和 Playwright 1.64.1。新增 Actions 固定为 checkout v6.0.2、upload-artifact v6.0.0 的完整 commit SHA；不追随浮动主版本。不引入跨作业 JAR／镜像传递，浏览器作业自行构建所需 Java 镜像。

CI 使用独立 Compose 项目名 `xiaoying-ci`。构建浏览器后端时显式指定 `xiaoying-backend:latest`，与现有 browser profile 引用保持一致，不依赖 Compose 自动生成的镜像名。每个作业结束时先收集诊断信息，再上传报告，最后清理本项目的临时容器与卷。检查步骤不使用 continue-on-error，报告保留 7 天。

## 4. 核心行为与证据入口

| 原题要求／场景 | 当前验证入口 |
| --- | --- |
| R-04 及时受理、后台独立运行 | `TaskConcurrencyTest` 的闸门、退出会话后继续执行；`scripts/smoke.mjs` 的无查询等待 |
| R-05／R-06 三步骤顺序与各阶段失败中断 | `TaskTest` 参数化 NONE／三个失败点，检查持久化步骤与终态 |
| R-06 耗时控制、两工作线程及排队 | `TaskConcurrencyTest`、`tasks.spec.ts` 的 2000ms 三任务场景、smoke 的 1000ms／0ms |
| R-07 查询异常与执行失败区分 | `task-tracking.spec.ts`、结果读取失败与重试用例 |
| R-08 多任务、停询、慢请求、迟到响应 | `tasks.spec.ts`、`task-lifecycle.spec.ts`、`task-ordering.spec.ts` |
| R-09 刷新、个人历史与分页 | `TaskQueryTest`、`tasks.spec.ts`、分页竞争用例 |
| R-10 用户和素材／任务隔离 | `SessionTest`、`TemplateAssetTest`、`TaskTest`、身份切换用例及 smoke |

先核对已有断言与实现路径，再决定是否补测。测试数量不作为目标。网络替身用于故障与乱序；真实上传、任务执行和历史读取仍经过 Java／MySQL。

## 5. 执行顺序与检查清单

- [x] 核对原题、当前命令与测试入口，写入本设计。
- [x] 新增工作流与 CI 报告配置，完成语法和 Compose 检查。
- [x] 在隔离项目运行 Java verify、前端检查、浏览器、HTTP 与 smoke。
- [x] 核对失败退出和清理路径，记录本地结果与远程未验证项。
- [x] 同步 README、需求清单和证据，检查暂存区并提交 Git。

顺序依据：先固定可执行入口，再跑昂贵的集成检查，最后整理真实结果。执行前推演发现的约束是镜像名随 Compose 项目名变化、npm ci 与 dev 共用依赖，以及缺少远程仓库；上述设计分别处理这些约束。若发现需要改变业务契约的问题，先记录影响并核对原题，不以改弱断言换取通过。

## 6. 验证记录

以下命令均在本地 Docker 执行，Compose 命令明确使用 `-p xiaoying-ci`。前端安装、Maven 下载使用新建缓存卷；测试数据库与文件目录隔离。没有重新部署或修改演示服务。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| Compose 配置 | test／browser 配置解析通过 | `docker compose -p xiaoying-ci --profile test --profile browser config --quiet` |
| 工作流语法 | actionlint 1.7.12 返回 0，无诊断 | `artifacts-phase6-actionlint.log` |
| Java verify | 16 项测试，0 失败／错误／跳过；JAR 构建成功 | `artifacts-phase6-backend.log`、`backend/target/surefire-reports/` |
| 前端检查 | npm ci、lint、typecheck、生产构建通过 | `artifacts-phase6-frontend.log` |
| 浏览器后端镜像 | 显式镜像名构建通过，隔离服务就绪 | `artifacts-phase6-image.log`、`artifacts-phase6-browser-start.log` |
| 浏览器回归 | 43 项通过，CI JUnit 为 43 tests／0 failures | `artifacts-phase6-browser.log`、`artifacts/phase-6/junit.xml` |
| HTTP 渲染 | 1 项通过 | `artifacts-phase6-http.log` |
| HTTP smoke | 两线程、排队、退出会话、成功、失败、归属及文件访问通过 | `artifacts-phase6-smoke.log`、`artifacts/smoke.json` |
| 数据库核对 | smoke 的 4 条任务与步骤记录符合预期 | `artifacts/phase-6/database-verification.json` |
| 失败控制 | Bash pipefail 保留退出码 7；临时失败用例返回 1，JUnit 记录 1 个失败 | `artifacts-phase6-failure-probe.log`、`artifacts/phase-6/failure-probe.xml` |
| 诊断与清理 | 服务日志已保存；隔离容器、网络和缓存卷已清理 | `artifacts/ci/`、`artifacts-phase6-cleanup.log` |

actionlint 检查使用容器镜像 digest `sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667`。它只用于本地配置验证，未加入应用依赖。

数据库核对读取 smoke 返回的任务 ID。3 条成功任务的阶段均为 RESULT_FINALIZATION，步骤均为 SUCCEEDED；每步配置 1000ms，实际执行总耗时分别为 3010／3012／3016ms。指定失败任务的配置为 0ms，停在 MOCK_GENERATION，步骤为 SUCCEEDED／FAILED／SKIPPED。数据与 HTTP 结果一致。

临时失败用例只放在被忽略的 artifacts 目录，通过隔离配置继承正式 CI reporter；验证后已删除临时源码。它未进入 43 项回归或 Git 提交。核对现有测试后没有新增业务测试，也没有修改业务实现、HTTP 契约、库表或 UI。

GitHub 托管事件触发、检出与 artifact 上传尚未验证：当前仓库没有 Git remote。本地 actionlint 与容器运行证明配置和检查命令可用，但不能替代平台实际运行。后续把仓库推送到 GitHub 后，应检查两个作业及报告上传结果；如失败，应修复并更新本文，不将本阶段的本地通过当作远程结果。

## 7. 配置依据

- [GitHub 工作流语法](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [checkout v6.0.2](https://github.com/actions/checkout/tree/v6.0.2)
- [upload-artifact v6.0.0](https://github.com/actions/upload-artifact/tree/v6.0.0)
