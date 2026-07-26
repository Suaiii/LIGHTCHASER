# 真封面卡标注清单（p1-cover · 0725）

> 背景：0725 决策者纠偏——此前 feed/p1 截图取的是 Row0 抖音壳首屏，**真封面 = 往下刷一条（Row1 col0，SceneSunsetCard：打分 + 背景图那张）**。本清单配 `screenshots/p1-cover-annotated.png`（自动标注版）与 `p1-cover.png`（干净版，2x），供平台 AI 照着重建；元素坐标见 `screenshots/p1-cover-annotations.json`（CSS 像素）。

## 元素对照（标注编号 → 是什么 → 数据从哪来）

| # | 元素 | 数据绑定 | 平台重建要点 |
|---|---|---|---|
| ① | 评分徽章 SUNSET SCORE **87/100** | `/api/sunset` → `score`（平台侧=光线评分公式，读 sun_events+weather_daily 表） | 大数字衬线体，动态值不做入场动画（反规则①） |
| ② | 等级标签「值得跑出门」 | `scoreLabel` 三档（高/中/低），copy_corpus 兜底 | 描边 pill，颜色随档位 |
| ③ | AI 标语大字「今晚西天会烧」 | 文案引擎逐日生成（prompts/01），衬线大字竖排布局 | hook ≤26 字红线 |
| ④ | 峰值行「峰值 19:15 · 约 14 分钟 · 向西看」+ "AI 译自今天的气象" | `peakTime`/倒计时/朝向，来自 sun_events | 等宽/正文混排 |
| ⑤ | 推荐机位名「塘朗山郊野公园 · 观景平台 · 西望机位」 | `recommendation.spot`（spots 表） | 动态值 |
| ⑥ | 距离/步行时长「4.2km · 步行 53 分钟」 | `recommendation.distance` + 路线（OSRM；平台侧可降级直线估算） | 动态值 |
| ⑦ | 左滑引导「← 左滑·看天空变色」 | 静态引导文案 | 指向 p2 追·光地图 |
| Ⓑ1 | 按钮「➤ 导航前往」 | 点击=拉起导航（平台侧待 #19 测绘定：能否吊起地图 App/小程序内导航） | 唯一主 CTA，追光橘实底 |
| ⑧ | 背景图（黄虚线区示意，实际全屏铺底） | **静态素材 `assets/jingansi-card-bg.jpeg`（1.4MB，需单独上传平台）**，其上叠三层渐变压暗 | 平台无此素材时先用深色渐变兜底 |

## 已知瑕疵（如实标注，非隐藏）

1. 顶部导航 tab 与 demo pill 含「上海」字样 + `demo-high-sustech` 调试文案——初赛遗留装饰性占位（`chrome.jsx` 硬编码 + `scenes.jsx` cityLabel 兜底"上海"），与评分/机位真实数据无关联；平台重建时**直接不做**这些壳元素即可。
2. 抖音壳（状态栏/底部 tab/右侧互动列）是模拟器 chrome，非卡片本体——平台侧 feed 卡只重建 ①–⑧ + Ⓑ1。
3. 背景图为静安寺实拍（初赛素材），深圳机位配图待样张三件套回流后替换；当前用作视觉基调参照合规（自有素材，非搬运）。

## 复跑方式

临时标注脚本已按约定删除；逻辑 = `capture_feed_pages.mjs` 的状态设置（tweaks 高分87+南科大）→ `window.dispatchEvent(new CustomEvent("guangbao:swipeVideo",{detail:"next"}))` 下滑到 Row1 → 截干净版 → DOM 查询元素矩形注入标注层再截一张。
