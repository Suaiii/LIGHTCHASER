# Agent 开发规范

版本：v1.2
日期：2026-07-10  
适用范围：剧本工具从需求、接口、前后端实现、Agent Runtime、Context/Trace 到交付的开发流程。  
来源：由 `_archive/2026-07-09-doc-cleanup/dev-process/` 中旧开发规范提炼而来，并按当前技术选型和前端代码现状更新。

---

## 1. 当前项目准口径

开发时必须优先读取以下当前文档：

1. `docs/final/01-产品流程与Agent协作.md`：6 个 StageContract、业务 DAG、Agent 参与矩阵和产物口径。
2. `docs/final/02-后端架构与服务边界.md`：最终技术栈、服务边界、目录结构和 Pi Runner 集成。
3. `docs/final/03-状态机与事件系统.md`：StageRun/AgentRun、并发、事件、SSE、幂等和恢复。
4. `docs/final/04-Context与安全合同.md`：认证授权、租户隔离、Context、PermissionProfile、OutputEnvelope 和 Evidence。
5. `docs/final/05-API与可观测性.md`：Workbench/API、前端交互、可观测性、权限和资源治理。
6. `modules/frontend/docs/01-frontend-code-understanding-and-backend-contract.md`：当前前端源码、功能、接口和字段映射。
7. `docs/development/implementation-plan.md`：2026-07-10 会话交接后的分阶段实施计划和 Issue 依赖。
8. `agent/`：已嵌入的 Agent / Skill / Reference 创作标准源快照；仅跟随上游仓库同步，不在本项目中分叉修改。
9. `contracts/`：Stage 与 OutputEnvelope 的机器真相源；Markdown 只能解释，不得另建冲突枚举。
10. `docs/development/architecture-sprint-0.md`：当前业务实现前置修复清单。
11. `evals/`：Agent 质量、成本和延迟的回归准入。

旧版编号合同、根目录 16/18 文档和历史审计只在追溯时查看：

```text
_archive/2026-07-09-final-consolidation/
_archive/2026-07-09-final-cleanup/
```

---

## 2. 第一性开发原则

1. **Postgres 是真相源**：主线、版本、Canon、发布状态不能只存在前端 state 或 Agent 记忆里。
2. **Postgres control plane 是唯一 durable owner**：Pi adapter 只负责 workspace 执行；worker activity 必须幂等，不叠加 LangGraph/Celery Canvas 作为第二状态机。
3. **Agent 输出都是候选**：必须先变成 `Problem / CandidateChange / Check / ArtifactDraft / MemorySignal`，不能直接覆盖主线。
4. **Context Builder 是唯一上下文入口**：Agent 不能随意读库、读全文、读 trace。
5. **fork 是版本层能力**：任意 `ArtifactVersion` 可派生，不在阶段 DAG 标固定 fork 点。
6. **Trace 默认隐藏但必须完整**：用户不看日志，系统必须能复盘。
7. **Canon 变更必须确认**：`MemorySignal` 不等于 `ProjectCanon`；正式设定必须走 `CanonPatchProposal`。
8. **前端保留 Laper 风格**：用户看产物、问题、修改、依据、影响、版本、下一步，不看工程日志。
9. **凡无必要，勿增实体**：新增表、领域对象、状态、服务、Agent、DTO 或抽象前，必须证明现有实体无法准确承载该职责；能扩展既有深模块时，不创建平行概念。
10. **不写臆测式防御性代码**：不为没有证据的假设增加 fallback、兼容分支、吞异常、静默纠正或重复校验；内部代码依赖已冻结合同，只有认证、授权、外部输入、文件系统、网络和第三方进程等真实信任边界做必要校验，并返回明确的 typed error。
11. **使用轮子必须先读文档与源码**：引入或升级 Pi、框架、SDK、数据库扩展等关键依赖时，必须锁定精确版本，阅读对应版本的官方文档、公开 API、关键生命周期源码和安全边界；审查结论写入 `docs/development/notes/`，不能只凭 README、类型声明或二手文章集成。
12. **禁止静默截断或丢失信息**：业务数据、Agent 输出、错误、Trace、Evidence、Context 和持久化字段不得用 `[:N]`、substring、超长丢弃、隐式摘要等方式截断。遇到边界限制时应保留原始真相并显式派生摘要，或在写入前以 typed error 拒绝；前端 CSS 省略仅影响显示，不得改变底层数据。

---

## 3. 标准开发管线

每个功能必须走这条主线：

```text
需求澄清
  -> PRD / Contract 草案
  -> Issue 切片
  -> Routing Gate
  -> 单 Issue 实现
  -> 自测
  -> 验收
  -> Code Review
  -> PR / 记录 / commit
```

除非是非常小的文案或路径修正，否则不要跳过 Issue。

---

## 4. 角色分工

| 角色 | 职责 | 禁止事项 |
|---|---|---|
| Codex 主会话 | 需求澄清、PRD 收敛、Issue 切片、Routing Gate、验收、Review 裁决、文档同步 | 不在需求未清时直接做大功能；不把最终判断交给子任务 |
| Research / Explorer 子任务 | 查官方文档、查代码现状、对比方案、输出证据和简明结论 | 不做最终产品判断；不扩大调研范围 |
| Implementation 会话 | 每个 issue 一个新会话，按 issue 修改代码/文档，自测并汇报 diff | 不实现 issue 外功能；不改无关文件；不绕过主线/Canon/Trace 规则 |
| Review 会话 | 找 bug、架构破坏、状态/权限/数据流错误、缺测试、过度实现 | 不写泛泛总结；不替代验收 |

---

## 5. 需求澄清规范

需求不清时先澄清，不急着写代码。

必须搞清楚：

- 用户要解决的真实问题是什么。
- 影响哪个入口：`modules/frontend`、`modules/backend`，或后端内部域 `agent-runtime / context / data-fusion / narrative-memory / trace-learning / contracts`。
- 是否改变 6 个 StageContract。
- 是否新增或修改核心对象：`StageRun / ArtifactVersion / CandidateChange / Problem / Check / EvidenceSummary / CanonPatchProposal / ReleasePackage`。
- 是否需要新增后端接口、字段或表。
- 是否影响前端用户可见对象。
- 是否涉及 Agent Context、Trace、Canon 或版本派生。

需求澄清产物建议放：

```text
docs/development/notes/<feature>/notes.md
docs/development/notes/<feature>/questions.md
```

临时材料不要长期留在根目录；用完应归档到 `_archive/`。

---

## 6. PRD / Contract 草案规范

PRD 或 Contract 草案必须包含：

- Problem Statement
- 用户故事
- Scope / Out of Scope
- 交互模型
- 核心对象和字段
- API / 后端依赖
- 状态机或流程
- 验收标准
- 测试 / 验证方式
- 风险和回退

对接口/字段类需求，优先写 Contract，而不是长 PRD。

---

## 7. Issue 切片规范

每个 issue 必须是一个可独立实现、可独立验收的垂直切片，不按“前端一个 issue、后端一个 issue”机械切。

Issue 必须包含：

```text
Title
User Value
Scope
Out of Scope
Dependencies
Files / Modules
Data Contract / API
Acceptance Criteria
Validation Commands
Risks
Status: ready-for-agent | needs-more-spec | in-progress | ready-for-review | done
```

Issue 建议位置：

```text
issues/NN-<slug>.md
```

当前目录已清理过，如需恢复 issue 目录，可重新创建。

---

## 8. Routing Gate

每个 issue 进入实现前，主会话必须回答：

1. 是否来自已确认的 PRD / Contract？
2. 用户价值是否明确？
3. 范围是否足够小？
4. 验收标准是否明确？
5. 是否需要先补设计文档？
6. 是否涉及跨模块接口？
7. 是否可能破坏数据模型、交互或阶段口径？
8. 是否需要测试或验证？
9. 是否可以交给新实现会话？
10. 如果失败，如何回退？

结果只有两种：

```text
ready-for-agent
needs-more-spec
```

`needs-more-spec` 不得进入实现。

---

## 9. 实现规范

实现会话必须：

1. 先读 issue 和相关文档。
2. 明确范围和非范围。
3. 修改代码/文档。
4. 自测。
5. 汇报变更文件、关键行为、检查结果、未检查原因、风险。

实现会话不得：

- 改无关文件。
- 删除用户已有改动。
- 把 mock 数据当正式合同。
- 让 Agent 直接覆盖主线版本。
- 让 `MemorySignal` 自动写入 `ProjectCanon`。
- 让外部数据绕过 SourceRef / EvidencePack。
- 把完整 trace、prompt、source 全文默认暴露给用户。

---

## 10. 前端开发规范

当前前端位置：

```text
modules/frontend/
```

前端现状：

- 已解压 Script Doctor Studio 前端代码。
- 业务数据集中在 `src/lib/laper-mock.ts`。
- 尚未接后端 API。
- 2026-07-10 再次运行 `bun install --frozen-lockfile`，长时间无输出后中止；build 仍未完成验证。

前端接后端顺序：

1. 修通依赖安装和 build。
2. 拆 `laper-mock.ts`：类型进 `src/types/`，demo 数据进 `src/fixtures/`。
3. 新增 API client。
4. 接 `GET /api/projects/{projectId}/workbench`。
5. 接项目、工作台、问题、候选修改、版本历史四条主链路。
6. 再接 Agent Doctor、Evidence/Trace、Release、Admin。

前端必须保持：

- Project Studio 为核心。
- Script-first / artifact-first，不做后台管理感。
- Trace 默认隐藏。
- EvidenceSummary 摘要化，不展示证据包全文。
- Fork 从 `ArtifactVersion` 菜单触发，不在 DAG 标固定 fork 点。
- 自动修改必须成为 `CandidateChange`，不能静默进主线。

---

## 11. 后端开发规范

最终技术栈：

```text
FastAPI + Pydantic v2 + SQLAlchemy 2 + Alembic
Postgres + pgvector
Object Storage: MinIO / R2 / S3
Celery + Redis
Pi-based Workspace Agent Runtime
Cognee Data Fusion Service
OpenTelemetry + workflow_events
```

后端优先实现：

1. `Project / StageRun / Artifact / ArtifactVersion`
2. `Problem / CheckResult / CandidateChange`
3. `ContextSnapshot / WorkflowEvent / LineageEdge`
4. `SourceRef / EvidencePack / EvidenceSummary`
5. `ProjectCanon / CanonPatchProposal`
6. `ReleasePackage`
7. `AgentThread / InteractionCommand / AgentRun`

后端硬规则：

- `ArtifactVersion` 是版本层核心，所有回滚、派生、采纳、发布都围绕它。
- `StageRun` 可失败、可恢复、可等待人工决策。
- `Check FAIL` 必须能转 `Problem`。
- `CandidateChange approve` 必须生成新 `ArtifactVersion` 或更新 mainline 指针，不能原地覆盖。
- `CanonPatchProposal approve` 才能写 `ProjectCanon`。
- `workflow_events` 必须记录 Agent 运行、上下文、输入输出、采纳、回退、失败。

---

## 12. Agent Runtime 开发规范

Pi-based StageRun 每个 workspace 共用骨架：

```text
StageRunStart
  -> LoadStageContract
  -> BuildContextSnapshot
  -> StageLeadPlan
  -> AgentNode / RetrievalNode / GateNode
  -> OutputTriage
  -> Validation
  -> HumanDecision?
  -> CommitArtifactVersion
  -> TraceFinalize
```

Agent Runtime 不得：

- 直接写 `ProjectCanon`。
- 直接发布 `ReleasePackage`。
- 绕过 `ContextSnapshot` 读取 source 全文。
- 把长报告直接塞进主线。
- 自动修改 `script-adaptation-visual-pack` 中的 Agent / Skill / Reference 标准源。

Agent 输出必须归一为：

```text
Problem
CandidateChange
CheckResult
ArtifactDraft
MemorySignal
EvidenceSummary
NextAction
```

---

## 13. 验收规范

实现完成后，主会话必须验收，不信任口头“完成”。

通用验收：

- 对照 issue 验收标准逐项检查。
- 查看 diff。
- 检查是否超范围实现。
- 检查命名是否符合当前领域模型。
- 检查是否把底层术语暴露给用户。
- 检查错误状态、空状态、权限边界。
- 检查文档是否同步。
- 检查是否新增了无必要实体、状态、服务或抽象。
- 检查是否存在无证据的 fallback、吞异常或静默纠正。
- 检查关键第三方依赖是否有精确版本的文档与源码审查记录。
- 检查是否存在截断、隐式摘要或其他不可逆信息丢失。

前端验收：

- 是否保持 Laper/Project Studio 体验。
- 是否围绕产物、问题、修改、依据、影响、版本、下一步。
- 是否避免把完整 DAG / trace / prompt 默认展示给用户。
- 是否支持 loading / empty / error / stale 状态。
- 是否有可运行的 build / lint / typecheck。

后端验收：

- Agent 不能直接改主线。
- Change merge 必须生成版本记录。
- Check FAIL 可转 Problem。
- Continuity impact 可标记 stale。
- Trace 能绑定 Run / Change / Version。
- ContextSnapshot 可复盘本次读取。

数据与记忆验收：

- SourceRef / EvidencePack 是否可追溯。
- EvidenceSummary 是否能解释采用、弃用、影响。
- Canon 写入是否需要确认。
- Session/Agent memory 是否没有自动污染 ProjectCanon。

---

## 14. Code Review 规范

Review 优先找风险，findings 放前面。

严重级别：

1. Blocking：数据污染、权限绕过、主线不可追溯、Canon 自动污染。
2. High：破坏产品模型、导致产物混乱、破坏连续性。
3. Medium：交互不符合规格、缺空状态、缺测试。
4. Low：命名、文案、局部清理。

必查：

- Agent 是否能直接改主线？如果能，Blocking。
- `CandidateChange / ArtifactVersion / Problem / Check` 是否混用？如果混用，High。
- Trace 是否默认暴露？如果是，Medium/High。
- `MemorySignal` 是否自动写 Canon？如果是，Blocking。
- 外部数据是否绕过 SourceRef / EvidencePack？如果是，Blocking。
- UI 是否让用户管理一堆无意义中间日志？如果是，High。
- 是否新增无法证明必要性的实体或平行抽象？如果是，High。
- 是否用防御性 fallback 掩盖合同或状态错误？如果是，High。
- 关键轮子是否未做对应版本的源码/文档审查？如果是，High。
- 是否静默截断或不可逆丢失业务信息？如果是，Blocking。

---

## 15. PR / 记录规范

每个完成的 issue 应记录：

```text
prs/NN-<slug>.md
```

内容：

- 对应 issue。
- 改动概要。
- 验收结果。
- 关键决策。
- 已运行检查。
- 未运行检查和原因。
- 遗留风险。

当前若暂时不使用 GitHub PR，也要保留本地 PR record，方便交接。

---

## 16. 当前推荐第一个开发切片

不要直接一口气接完整后端。建议第一个 issue：

```text
Architecture Sprint 0 完成后执行 Issue 001: Development baseline and API contract boundary
```

范围：

- 诊断并修通 frontend install/build/typecheck/lint/test 基线。
- 拆 `laper-mock.ts` 为 `types` + `fixtures`，保持现有 UI 行为。
- 新增统一 API client、错误响应和 query provider，但仍由 fixture adapter 提供业务数据。
- 将 FastAPI 整理为可测试的 app factory，建立统一错误格式。
- 用 `/health` 完成 Pydantic → OpenAPI → 前端生成类型的最小合同链路。
- 不接 Project/Workbench 真实业务表和接口。

验收以 `issues/001-development-baseline-and-api-contract.md` 为准。
