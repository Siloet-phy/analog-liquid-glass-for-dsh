# 变更记录

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## 未发布 — 2026-10-13

**改名**
- 项目定名 **Analog Liquid Glass for DeepSeek Harness**；仓库与包名由
  `dsh-liquid-glass-composer` 改为 `analog-liquid-glass-for-dsh`
  （旧链接由 GitHub 自动重定向）。代码标识（bundle id / `STYLE_ID` / `exports.name` /
  `cordis.patch.yml` 的 name / locale）已全部同步。
- 新图标：玻璃观液管 + 弯液面 + 上升气泡（走"模拟仪表"的语言，对应名字里的 Analog）。

**移除**
- **边缘绕行光晕（初版的 1.5px 渐变镶边）已删除。** 它用"放大的盒子 + `mask-composite`
  只留边线"实现，在不同合成路径下一旦失效，深色下会变成一圈巨大的旋转发光矩形。
  要做镶边请让盒子就是玻璃本身。

**修正**
- 修 `hooks` 违规：`useSession` 曾按条件调用（调用与否不确定），已改为无条件定序调用。
- 忙碌状态新增兜底探测：拿不到标准 props 的 `useSession` 时，改为观察原生发送按钮的
  「发送 ↔ 停止」态，避免气泡**静默不出现**且无任何报错。
- 读原生卡片圆角时对 `getComputedStyle` 加保护（该全局不存在时会抛错并中断整个挂载）。
- 几何锚定改为「卡片矩形 − 自身矩形」的**差值**：卡片一旦带 `backdrop-filter`
  就会成为 `position:fixed` 的包含块，直接写视口坐标会偏移叠加两次。
- README/CHANGELOG 中关于"绕行镶边""不改原生样式"的表述与实际实现对齐。

## 0.1.0 — 2026-10-12

首个版本。

**玻璃层**
- 磨砂玻璃：白雾 + `blur(26px)`，玻璃感的来源
- 顶部镜面高光、内缘白线、外扩散泛光

**状态反馈**
- 模型思考时玻璃里冒泡：三颗泡错开 1/3 周期、同一个出生点，一个破灭、一个新生
- 冷调底与外泛光随忙碌状态提亮

**主题**
- 深浅两套色值跟随 `body[data-ds-dark-theme]`
- 监听 `theme/change`，切换时玻璃以 1.7s 插值（比整页 0.9s 更从容）

**无障碍**
- 遵循 `prefers-reduced-motion`：动画全停，保留静态玻璃与状态色

**不变量**
- 玻璃层只往 slot 里加层，靠测量原生卡片矩形贴合，不改其 DOM 结构
  （唯一例外是"真毛玻璃"覆盖卡片背景与 `backdrop-filter`，见 README）
- 玻璃里不放彩色，颜色只在边缘高光上
