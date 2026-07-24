# D 提示词包 · 平台可贴重排（HERMES-09 §2）

> 源材料：`agents_output/03/`（prompt_pack.md / fallback_matrix.json / copy_samples.v1.json）+ `agents_output/02/score_spec.md`。
> 硬规则原文**不删改**（对照 `agents_output/03/prompt_pack.md` diff 仅排版差异，见 `check_report_09.md` 证据）。

## 为什么拆三块

「行动文案」和「拍摄建议」在原型/ARK 盲测里其实是**同一次模型调用**产出的同一个 JSON（`{"hook":..., "tips":[...]}`，见 `prompt_pack.md §1`）——这里按平台粘贴习惯拆成两份文档，是因为平台对话可能需要在不同触点（卡片正文 vs 建议列表）分别引用，**不代表可以拆成两次独立调用**：拆开引用时务必让模型仍按同一份系统提示词一次产出两者，再各取所需字段，否则会破坏"3条建议必须呼应同一份输入JSON"的一致性约束。

「评分解释」是新增块——AGENT_03 材料本身不含评分解释生成器（评分靠公式而非模型生成，见 `score_spec.md §1`"可解释、可复算，答案是这一页，不是黑盒"）。本块把 `light_engine.js` 的五因子公式转成**面向用户的自然语言解释模板**，规则来源=`agents_output/02/score_spec.md`（非 AGENT_03 原文，故不计入"硬规则与 03 原文 diff"校验范围）。

## 三块清单

| 块 | 文件 | 触点 |
|---|---|---|
| ① 行动文案 | `01-action-copy.md` | feed 卡 hook 一句话 |
| ② 拍摄建议 | `02-shooting-tips.md` | 3 条 tips 列表 |
| ③ 评分解释 | `03-score-explanation.md` | "分数怎么来的"追问/详情页 |

每块内部结构固定：**硬规则 → few-shot → 兜底策略**，与官方"每块=硬规则+few-shot+兜底"要求对齐。
