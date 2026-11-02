# HTTP 接口文档

状态：17 个 HTTP 操作已实现，后端测试及 Next.js 同源联调已通过。阶段三已接入身份、模板、上传与任务受理；阶段四已接入状态查询、历史与结果展示。

更新日期：2026-11-02。配套文档：[阶段二设计](phase-2-design.md)、[库表设计](database-design.md)。

## 1. 范围与维护

本文是 HTTP 路径、字段、状态枚举和错误码的维护入口。修改接口时，同步更新 Controller／DTO、数据库映射、前端调用和测试；不保留另一份不同的接口清单。

[阶段三](phase-3-design.md) 接入会话、模板、上传及任务创建接口。提交页只展示受理快照，不将其当作实时状态；网络错误和 5xx 不触发自动重发。阶段三不新增接口或字段。

阶段三调用规则：会话写操作串行执行；写响应异常后重新读取当前会话。私有接口返回 401 时清空表单并要求重新选择身份。上传响应与上传位的当前请求绑定；切换用户、模板或素材后丢弃旧响应。创建任务时禁用素材编辑与重复提交；202 响应无法解析时同样视为结果未确认，不自动创建第二个任务。浏览器取消请求不代表后端撤销已经接收的上传或任务。

[阶段四](phase-4-design.md) 已实施以下调用规则：身份确认后读取历史及 active，按已知未完成 ID 批量查询 status，并按 version 合并；终态和 missingIds 停止跟踪。查询错误保留已有快照并暂停轮询，用户可主动恢复。结果读取错误不改变任务状态。制作页历史按模板筛选，个人历史不传 templateId。本阶段没有新增 HTTP 字段或路径。

状态查询每批最多 100 个 ID，同一轮顺序分批，上一轮结束约 2 秒后再查。页面隐藏时暂停新一轮查询，重新可见时先确认身份。历史每页 20 条，加载更多使用原 cursor；刷新使旧分页响应失效。新受理任务独立保留，不因较早的历史页返回而消失。切换用户或页面后取消请求，并通过作用域检查丢弃迟到响应。

开发入口为 `http://localhost:3000`，Next.js 将请求转发到 Java。业务前缀为 `/api`，公开素材前缀为 `/demo`。浏览器不直接访问容器服务名。

## 2. 通用协议

### 2.1 请求与响应

- JSON 使用 UTF-8、camelCase，Content-Type 为 `application/json`。
- 成功响应直接返回对象。普通列表返回 `{ "items": [] }`，历史列表还返回 `nextCursor`。
- 有值的 ID 均为字符串。素材和任务 ID 是小写 UUID，用户和模板 ID 是最多 64 字符的稳定代码。
- API 时间均为 UTC，格式为 `2026-11-02T06:00:00.000Z`，保留毫秒。
- 未知 JSON 字段、错误字段类型、未知枚举和格式错误返回 400。不能用 `userId` 指定素材或任务所有者。
- 文中明确可空的响应字段应返回 `null`，不随状态省略；可选请求字段可以省略。
- 会话、素材和任务接口设置 `Cache-Control: no-store`。前端不缓存个人数据为公共页面内容。
- 204 响应没有正文。二进制接口返回文件内容，不加 JSON 包装。

### 2.2 会话

Java 使用 `HttpSession`。成功选择身份后设置 `JSESSIONID`，属性为 HttpOnly、SameSite=Lax、Path=/。本地 HTTP 演示不设 Secure；HTTPS 部署应设 Secure。会话空闲超时设为 30 分钟，读写个人接口可刷新空闲时间。

浏览器同源请求自动携带 Cookie。Next.js 转发 Cookie 和 Set-Cookie，不创建另一套身份。身份切换会使旧会话失效，并创建新会话。

未选择身份或会话失效时，受保护接口返回 401。不存在或不属于当前用户的单条资源均返回 404。服务器不会通过错误信息区分这两种情况。

`DEMO_MODE=true` 才提供用户列表和身份选择。关闭时，这两个入口返回 404；当前会话读取与退出接口仍可调用，但项目不新增其他登录方式。

### 2.3 请求错误对象

```json
{
  "code": "VALIDATION_ERROR",
  "message": "请求参数不符合要求",
  "fieldErrors": {
    "assetIds": "该模板需要 2 张不同的已上传图片"
  }
}
```

`code` 是稳定字符串，客户端可以据此分支。`message` 为用户提示，不依赖固定措辞编程。`fieldErrors` 是字段路径到单条提示的映射，无字段错误时省略。

**HTTP 请求错误与任务执行失败不同。** 查询一个失败任务仍返回 200，失败原因放在 `Task.failure`。网络异常或查询 5xx 不改变任务状态。

### 2.4 HTTP 错误码

| HTTP | code | 使用场景 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 参数缺失、类型／范围／枚举／UUID 无效、输入数量不符、重复素材 |
| 400 | `INVALID_IMAGE` | 内容为空、JPEG／PNG 文件损坏或无法识别为有效图片 |
| 400 | `INVALID_CURSOR` | cursor 无法解析、版本不符或与当前用户／模板筛选不匹配 |
| 400 | `SIMULATION_NOT_ALLOWED` | 非演示配置下提交 simulation 字段 |
| 401 | `UNAUTHENTICATED` | 缺少有效会话 |
| 404 | `NOT_FOUND` | 用户、模板、任务、素材不可见或演示入口未开放 |
| 409 | `RESULT_NOT_READY` | 本人任务尚未成功，没有结果可读取 |
| 413 | `FILE_TOO_LARGE` | 文件或 multipart 请求超过服务端限制 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 请求 Content-Type 不符或实际图片类型不被模板接受 |
| 500 | `FILE_UNAVAILABLE` | 已登记素材／成功结果对应文件缺失或不可读 |
| 500 | `INTERNAL_ERROR` | 未分类的服务端错误 |
| 503 | `DEPENDENCY_UNAVAILABLE` | 数据库或就绪检查依赖不可用 |

异常堆栈只写服务端日志。错误响应不暴露数据库密码、绝对文件路径或他人记录。

## 3. 公共对象和状态

### 3.1 `User`

```json
{
  "id": "demo-alice",
  "displayName": "小禾"
}
```

### 3.2 `Template`

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

所有字段非空。封面 URL 为同源相对地址。服务端不返回结果预置路径或磁盘路径。首版模板图片要求为 1、2、3 张，当前单张上限均为 5 MiB。

### 3.3 `Asset`

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "originalName": "mountain.png",
  "mimeType": "image/png",
  "sizeBytes": 11780,
  "previewUrl": "/api/assets/11111111-1111-4111-8111-111111111111/content"
}
```

所有字段非空。示例 ID 仅说明格式，不是已有可调用资源。`sizeBytes` 是实际文件大小。

### 3.4 `Task`

| 字段 | JSON 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `id` | string | 否 | 任务 UUID |
| `templateId` | string | 否 | 模板 ID |
| `templateTitle` | string | 否 | 创建时模板标题 |
| `status` | string | 否 | 整体状态 |
| `stage` | string | 是 | 当前或最后执行阶段 |
| `version` | integer | 否 | 创建为 0，状态事务提交后递增 |
| `createdAt` | string | 否 | 受理时间 |
| `startedAt` | string | 是 | 首次开始执行时间 |
| `finishedAt` | string | 是 | 成功或失败时间 |
| `resultUrl` | string | 是 | 仅成功任务提供的同源结果 URL |
| `failure` | object | 是 | 仅失败任务提供的失败对象 |

```json
{
  "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "templateId": "travel-duo",
  "templateTitle": "海边双拼",
  "status": "QUEUED",
  "stage": null,
  "version": 0,
  "createdAt": "2026-11-02T06:00:00.000Z",
  "startedAt": null,
  "finishedAt": null,
  "resultUrl": null,
  "failure": null
}
```

整体状态：

| status | 含义 | 终态 |
| --- | --- | --- |
| `QUEUED` | 已受理、等待执行 | 否 |
| `RUNNING` | 后台执行中 | 否 |
| `SUCCEEDED` | 三步完成且结果已保存 | 是 |
| `FAILED` | 阶段执行或调度失败 | 是 |

阶段：

| stage | 顺序 | 含义 |
| --- | --- | --- |
| `MATERIAL_CHECK` | 1 | 素材检查 |
| `MOCK_GENERATION` | 2 | 模拟生成 |
| `RESULT_FINALIZATION` | 3 | 结果整理 |

排队时 stage 为空。成功时 stage 保留 `RESULT_FINALIZATION`。执行失败时保留失败阶段，调度失败时为空。

`failure` 的结构如下；非失败任务整个字段为 null：

```json
{
  "code": "SIMULATED_FAILURE",
  "stage": "MOCK_GENERATION",
  "message": "模拟生成阶段按演示配置失败"
}
```

| failure.code | failure.stage | 含义 |
| --- | --- | --- |
| `SIMULATED_FAILURE` | 指定阶段 | 按任务模拟配置触发 |
| `MATERIAL_INVALID` | `MATERIAL_CHECK` | 后台检查发现输入不再满足模板要求 |
| `MATERIAL_UNAVAILABLE` | `MATERIAL_CHECK` | 输入文件缺失或不可读 |
| `GENERATION_FAILED` | `MOCK_GENERATION` | 选择预置结果或生成准备失败 |
| `RESULT_STORAGE_FAILED` | `RESULT_FINALIZATION` | 复制、保存或检查结果失败 |
| `EXECUTOR_CAPACITY_EXCEEDED` | null | 队列已满，未开始执行 |
| `EXECUTOR_UNAVAILABLE` | null | 执行器不再接受任务 |
| `TASK_EXECUTION_ERROR` | 当前阶段 | 未分类执行异常 |

服务器查询已失败任务时不会再次执行。任务返回的 `version` 只用于拒绝旧快照，不作为前端进度百分比。

### 3.5 `TaskDetail` 与 `TaskStep`

`TaskDetail` 包含 Task 的全部字段，额外包含非空数组 `steps`。每个任务始终有三个步骤，按执行顺序排列。

```json
{
  "stage": "MATERIAL_CHECK",
  "status": "PENDING",
  "startedAt": null,
  "finishedAt": null,
  "failureReason": null
}
```

步骤状态为 `PENDING`、`RUNNING`、`SUCCEEDED`、`FAILED`、`SKIPPED`。失败后，后续步骤为 SKIPPED，开始时间为空，完成时间为标记跳过的时间。只有实际失败步骤包含 failureReason。

## 4. 健康检查、身份与模板

### 4.1 `GET /api/health`

不要求会话。数据库可连接且初始化完成时返回 200：

```json
{ "status": "UP" }
```

依赖不可用返回 503／`DEPENDENCY_UNAVAILABLE`。该接口仅用于就绪检查，不推进任务。

### 4.2 `GET /api/demo-users`

不要求会话，要求 DEMO_MODE。返回 200：

```json
{
  "items": [
    { "id": "demo-alice", "displayName": "小禾" },
    { "id": "demo-bob", "displayName": "阿远" }
  ]
}
```

按 ID 升序返回。关闭演示模式返回 404。

### 4.3 `POST /api/session`

不要求旧会话，要求 DEMO_MODE。请求：

```json
{ "userId": "demo-alice" }
```

`userId` 必填，非空字符串，最长 64 字符。未知用户返回 404，参数错误返回 400。校验成功后再废弃旧会话并建立新会话，返回 200／User 及 Set-Cookie。失败请求不切换当前身份。

### 4.4 `GET /api/session`

返回 200／User。没有有效会话返回 401。页面刷新或窗口重新获得焦点时可调用此接口确认身份。

### 4.5 `DELETE /api/session`

退出并使当前会话失效，清除对应 Cookie，返回 204。会话已失效时仍返回 204。退出不取消已创建任务。

### 4.6 `GET /api/categories`

不要求会话。读取模板表，按分类代码升序去重，返回 200：

```json
{
  "items": [
    { "code": "design", "name": "创意设计" },
    { "code": "travel", "name": "旅行记忆" }
  ]
}
```

没有模板时返回空 items。分类名称一致性在初始化时检查，不由前端另存一份映射。

### 4.7 `GET /api/templates`

不要求会话。可选查询参数 `category`：非空字符串，最多 64 字符；省略表示全部，未知分类返回空列表。

返回 200／`{ "items": [Template] }`，按 `sortOrder ASC, id ASC` 排序。首版模板数量固定且较少，不分页。不返回内部 sortOrder 字段。

### 4.8 `GET /api/templates/{id}`

不要求会话。返回 200／Template。ID 不存在返回 404；ID 为空或超长返回 400。

## 5. 素材接口

### 5.1 `POST /api/assets`

要求会话，Content-Type 为 `multipart/form-data`。

| 字段 | 类型 | 必填 | 规则 |
| --- | --- | --- | --- |
| `file` | 单个文件 part | 是 | 非空、实际类型为模板允许的 JPEG／PNG，大小不超过模板限制 |
| `templateId` | 文本 part | 是 | 有效模板 ID，最长 64 字符 |

每次上传一个文件。总请求上限设为 6 MiB，单文件上限设为 5 MiB；总请求上限为 multipart 字段保留空间。服务端仍按模板的 maxFileSizeBytes 再校验单文件。

服务器读取实际图片内容，不能只相信扩展名或请求 MIME。originalName 取文件名部分，去除目录成分，要求 1–255 字符；存储名由服务端生成。PNG／JPEG 之外返回 415，损坏图片返回 400，过大返回 413，未知模板返回 404。

成功保存文件和素材记录后返回 201／Asset。失败响应不包含可提交素材 ID。客户端取消上传不保证服务端停止保存，未引用素材暂不自动清理。

### 5.2 `GET /api/assets/{id}/content`

要求会话。成功返回 200 和文件内容，Content-Type 使用服务端识别的 image/jpeg 或 image/png，Content-Disposition 为 inline。返回 no-store。

无效 UUID 返回 400，不可见素材返回 404。记录存在但文件不可读返回 500／FILE_UNAVAILABLE。

没有素材删除接口。页面移除或替换上传位只改变本次待提交的 assetIds，不删除历史任务引用的素材。

## 6. 任务创建与查询

### 6.1 `POST /api/tasks`

要求会话。请求：

```json
{
  "templateId": "travel-duo",
  "assetIds": [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222"
  ]
}
```

| 字段 | 类型 | 必填 | 规则 |
| --- | --- | --- | --- |
| `templateId` | string | 是 | 有效模板 ID，最长 64 字符 |
| `assetIds` | string[] | 是 | 有序 UUID 数组；数量等于模板要求；不能重复；所有素材属于当前用户 |
| `simulation` | object | 否 | 仅演示模式允许，见下文；显式 null 视为无效参数 |

服务端再次校验素材实际类型、大小及文件可读性。任意不可见素材返回 404，不返回他人素材信息。数量或重复错误返回 400，模板不接受的 MIME 返回 415，超大素材返回 413，已登记文件缺失返回 500。同步校验失败不创建任务。

可选模拟参数：

```json
{
  "templateId": "mountain-card",
  "assetIds": ["11111111-1111-4111-8111-111111111111"],
  "simulation": {
    "stepDelayMs": 3000,
    "failAtStage": "MOCK_GENERATION"
  }
}
```

`stepDelayMs` 可省略，默认取环境配置，范围为 0–30000 的整数，不能为 null。`failAtStage` 可省略或为 null，默认不触发失败；非空时为三个阶段枚举之一。服务器补齐默认值后将配置保存在当前任务中。

非演示模式只要出现 simulation 字段就返回 400／SIMULATION_NOT_ALLOWED。未提供 simulation 时使用服务端默认耗时并成功模拟，不使用随机失败。

成功受理返回 **202／Task**，并设置 `Location: /api/tasks/{id}`。响应通常是创建时的 QUEUED 快照，后台可能已经推进；客户端按 version 合并后续快照。

执行器拒绝已登记任务时，服务端保存 FAILED 和调度原因，再返回 202／失败任务。202 表示任务已登记，不保证最终成功。若无法登记失败状态则返回 5xx；网络或服务异常不保证请求未被受理，本题不实现提交幂等，客户端不自动重发创建请求。

### 6.2 `GET /api/tasks/{id}`

要求会话。返回 200／TaskDetail。有效 UUID 但不可见返回 404，格式错误返回 400。成功、处理中和失败均返回 200，只有接口请求异常使用 4xx／5xx。

任务和三个步骤在同一个 REPEATABLE READ 只读事务中读取。响应不包含用户 ID、输入文件路径、模拟配置或异常堆栈。查询不驱动后台执行。

### 6.3 `GET /api/tasks`

要求会话。

| 参数 | 类型 | 必填 | 规则 |
| --- | --- | --- | --- |
| `limit` | integer | 否 | 默认 20，范围 1–100 |
| `cursor` | string | 否 | 使用上一页 nextCursor 原值；空字符串无效 |
| `templateId` | string | 否 | 按模板筛选；省略为当前用户全部历史 |

返回 200：

```json
{
  "items": [],
  "nextCursor": null
}
```

非空 items 的每项为 Task，不含 steps。记录按 `createdAt DESC, id DESC` 排序。不存在的模板筛选返回空列表。最后一页 nextCursor 为 null。

服务端获取 limit＋1 条以判断下一页。cursor 使用 Base64URL 编码的 JSON，包含 `v=1`、`userId`、`templateId`（无筛选为 null）、最后一条 `createdAt` 和 `id`。cursor 是分页位置，不是权限凭据；所有查询仍显式限定会话用户。

cursor 解码失败、字段错误或筛选／用户不匹配返回 400／INVALID_CURSOR。翻页条件为创建时间更早，或时间相同且 ID 更小。翻页过程中新增任务在重新加载首屏时出现，不承诺多页查询是同一时间快照。

### 6.4 `GET /api/tasks/active`

要求会话。不接受 templateId 筛选，不分页。返回 200／`{ "items": [Task] }`，包含当前用户所有 QUEUED、RUNNING 任务，按创建时间和 ID 倒序。

该接口用于进入页面和刷新时恢复跟踪集合。不能只用历史第一页恢复任务。此接口不适合单独检测任务终态，因为已结束任务会从集合消失；后续使用批量状态接口。

### 6.5 `GET /api/tasks/status`

要求会话。必填查询参数 `ids` 为逗号分隔的 1–100 个不同 UUID。空值、重复 ID 或格式错误返回 400。

返回 200：

```json
{
  "items": [],
  "missingIds": ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]
}
```

items 是当前用户可见的 Task，包含已经成功或失败的任务，顺序遵循请求 ID 顺序。missingIds 记录不存在或不属于当前用户的请求 ID，两种情况不作区分。格式正确且全部不可见时仍返回 200。

前端后续应从跟踪集合移除终态和 missingIds，但不能将 missingIds 标为任务执行失败。请求异常时保留已有快照。active、status 是固定路由，不作为任务 ID 解析。

### 6.6 `GET /api/tasks/{id}/result`

要求会话。成功返回 200 和预置 SVG 的任务副本，Content-Type 为 `image/svg+xml`，Content-Disposition 为 inline，Cache-Control 为 no-store。

不可见任务返回 404；本人任务状态不是 SUCCEEDED 时返回 409／RESULT_NOT_READY，包括 FAILED。成功记录对应文件丢失返回 500／FILE_UNAVAILABLE；读取失败不将 SUCCEEDED 改写为 FAILED。

## 7. 公开资源

### `GET /demo/{path}`

不要求会话。只读取随应用打包的 `covers/` 和 `results/` 目录中登记的预置文件。示例：`/demo/covers/travel-duo.svg`。

成功返回 200 和 image/svg+xml。未登记路径、其他目录和路径越界返回 404。用户上传和任务私有结果不通过这个接口提供。公开预置结果用于展示模拟样例，不能据此判断某个任务已成功。

## 8. 文档调用示例

以下 PowerShell 7 示例供手动调用。输入路径指向现有示例文件；返回 ID 由实际服务生成。本轮在容器内执行了等价的 Node.js HTTP 场景脚本 `scripts/smoke.mjs`，未直接运行这段 PowerShell 示例。

```powershell
$baseUri = 'http://localhost:3000'
$identityBody = @{ userId = 'demo-alice' } | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "$baseUri/api/session" `
    -ContentType 'application/json' -Body $identityBody `
    -SessionVariable demoSession

$upload = Invoke-RestMethod -Method Post -Uri "$baseUri/api/assets" `
    -WebSession $demoSession -Form @{
        templateId = 'mountain-card'
        file = Get-Item 'C:\all\work\xiaoying\assets\demo\inputs\mountain.png'
    }

$taskBody = @{
    templateId = 'mountain-card'
    assetIds = @($upload.id)
    simulation = @{
        stepDelayMs = 3000
        failAtStage = $null
    }
} | ConvertTo-Json -Depth 4

$task = Invoke-RestMethod -Method Post -Uri "$baseUri/api/tasks" `
    -WebSession $demoSession -ContentType 'application/json' -Body $taskBody

Invoke-RestMethod -Uri "$baseUri/api/tasks/$($task.id)" -WebSession $demoSession
Invoke-RestMethod -Uri "$baseUri/api/tasks?limit=20" -WebSession $demoSession
```

演示指定阶段失败时，将 failAtStage 改为对应枚举后创建新任务。演示排队时连续创建三个较长耗时任务。演示用户隔离时使用另一个 WebSession 选择 demo-bob，再读取原任务，预期 404。

前端后续应先确认身份，再读取历史和 active，最后按未完成 ID 查询 status；不因查询失败自动重建任务。

## 9. 实现验证清单

- 身份切换成功后 Cookie 更新；无效用户不清除有效旧会话。
- 模板、分类和个人记录读取 Java 数据；空列表返回 200 和空 items。
- multipart 类型、实际图片类型、文件大小和模板数量在服务端校验。
- 任务创建不等待三个阶段完成；202 与任务终态含义明确。
- 请求错误使用 HTTP 错误码；执行失败作为 200 任务对象返回。
- 历史 cursor 在同时间记录及模板筛选下不丢失、不重复。
- active 不受历史分页限制；status 返回请求中已进入终态的任务。
- 所有个人记录及二进制接口检查归属，不返回磁盘路径。
- 查询、预览失败不改变任务状态；后续查询不能使终态回退。

以上契约已通过源码核对、后端集成测试与容器 HTTP 场景验证。16 项后端测试覆盖三阶段成功／失败、并发队列、同时间分页、用户隔离、参数边界与文件缺失；smoke 脚本覆盖 Cookie、multipart 和二进制同源转发。完整证据及未完成的前端范围见[阶段二设计第 11 节](phase-2-design.md#11-现状执行条件和变更记录)。

## 10. 变更记录

| 日期 | 变化 | 影响 |
| --- | --- | --- |
| 2026-11-02 | 首版，定义 17 个 HTTP 操作及公共对象 | 作为前后端实现与验收依据 |
| 2026-11-02 | 历史增加可选 templateId；明确 cursor、批量查询与错误语义 | 对齐制作页按模板查看历史、刷新恢复和多任务跟踪 |
| 2026-11-02 | 17 个操作实现并完成同源联调；JSON 拒绝数字转字符串，时间固定输出毫秒 | 落实既有协议，未增加接口或更改字段 |
