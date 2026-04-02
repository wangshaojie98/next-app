# 暖调中性主题设计

## 目标

将当前冷调的石板蓝配色替换为暖调中性色板，在保持浅色背景的同时实现精致、高级的视觉质感。

## 范围

- `app/globals.css` — CSS 变量和 SVG 样式覆盖
- `components/skill-flow-studio.tsx` — Graphviz 节点/边的主题颜色

## CSS 变量

| 变量 | 当前值 | 新值 | 说明 |
|------|--------|------|------|
| `--background` | `#f8fafc` | `#faf9f7` | 暖米白 |
| `--background-soft` | `#ffffff` | `#ffffff` | 不变 |
| `--foreground` | `#334155` | `#3c3836` | 暖深灰 |
| `--muted` | `#64748b` | `#8b7e6a` | 暖灰 |
| `--muted-strong` | `#475569` | `#5c5347` | 较深暖灰 |
| `--accent` | `#2563eb` | `#b8860b` | 暗金色 |
| `--panel` | `rgba(255,255,255,0.92)` | `rgba(255,255,255,0.92)` | 不变 |
| `--panel-strong` | `rgba(255,255,255,0.96)` | `rgba(255,255,255,0.96)` | 不变 |
| `--preview` | `#ffffff` | `#ffffff` | 不变 |
| `--line` | `#e2e8f0` | `#e8e4de` | 暖色边框 |
| `--line-strong` | `#cbd5e1` | `#d4cfc7` | 较深暖色边框 |

## 选中高亮

`::selection` 背景色: `rgba(184, 134, 11, 0.14)`（金色调，替换原有蓝色调）。

## Graphviz 节点主题

### 动作节点 (box)
- 边框: `#b8860b`（暗金色）
- 填充: `#faf5eb`（暖奶油色）
- 文字: `#3c3836`

### 决策节点 (diamond)
- 边框: `#a0522d`（赭石色）
- 填充: `#fdf6f0`（暖杏色）
- 文字: `#3c3836`

### 起止节点 (doublecircle)
- 边框: `#6b5b3e`（深棕色）
- 填充: `#f7f4ee`（暖白色）
- 文字: `#3c3836`

### 边
- 线条颜色: `#8b7e6a`（暖灰色）
- 标签颜色: `#a0522d`（赭石色，替换原有红色）

## globals.css 中的 SVG 样式覆盖

- `.graphviz-stage .node text` fill: `#3c3836`
- `.graphviz-stage .edge text` fill: `#a0522d`，stroke: `#ffffff`

## 涉及文件

1. `app/globals.css` — 更新 CSS 变量和 SVG 样式覆盖
2. `components/skill-flow-studio.tsx` — 更新 `getNodeTheme()` 颜色和 `buildStyledGraph()` 中的边属性

## 不在范围内

- 暗色模式
- 字体变更
- 布局或间距变更
- 组件结构变更
