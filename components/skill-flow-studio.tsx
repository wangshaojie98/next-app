"use client";

import {
  instance,
  type Attributes,
  type Graph,
  type RenderError,
  type Viz,
} from "@viz-js/viz";
import { useDeferredValue, useEffect, useState } from "react";
import { DEFAULT_SKILL_FLOW_DOT, parseSkillFlowDot } from "@/lib/skill-flow";

type SkillFlowStudioProps = {
  initialDot?: string;
};

type RenderState = {
  status: "idle" | "rendering" | "success" | "failure";
  svg: string;
  errors: RenderError[];
};

const DEFAULT_RENDER_STATE: RenderState = {
  status: "idle",
  svg: "",
  errors: [],
};

const GRAPHVIZ_OPTIONS = {
  engine: "dot" as const,
  graphAttributes: {
    bgcolor: "transparent",
    pad: "0.4",
    nodesep: "0.4",
    ranksep: "0.72",
    splines: "polyline",
    rankdir: "TB",
  },
};

function getNodeTheme(shape: string): Attributes {
  if (shape === "diamond") {
    return {
      shape: "diamond",
      style: "filled",
      color: "#a0522d",
      fillcolor: "#fdf6f0",
      fontcolor: "#3c3836",
      penwidth: "2",
      margin: "0.18,0.14",
    };
  }

  if (shape === "doublecircle") {
    return {
      shape: "box",
      style: "rounded,filled",
      color: "#6b5b3e",
      fillcolor: "#f7f4ee",
      fontcolor: "#3c3836",
      peripheries: 2,
      penwidth: "2.4",
      margin: "0.24,0.17",
    };
  }

  return {
    shape: "box",
    style: "rounded,filled",
    color: "#b8860b",
    fillcolor: "#faf5eb",
    fontcolor: "#3c3836",
    penwidth: "2",
    margin: "0.22,0.16",
  };
}

function buildStyledGraph(source: string): string | Graph {
  const parsed = parseSkillFlowDot(source);

  if (parsed.issues.length > 0) {
    return source;
  }

  return {
    name: parsed.name,
    directed: true,
    graphAttributes: {
      bgcolor: "transparent",
      rankdir: "TB",
      pad: "0.38",
      nodesep: "0.4",
      ranksep: "0.72",
      splines: "polyline",
    },
    edgeAttributes: {
      color: "#8b7e6a",
      fontcolor: "#a0522d",
      fontname:
        "SFMono-Regular, SF Mono, JetBrains Mono, Menlo, Consolas, monospace",
      fontsize: "11",
      arrowsize: "0.78",
      penwidth: "2",
      labelfloat: true,
    },
    nodes: parsed.nodes.map((node) => {
      const nodeTheme = getNodeTheme(node.shape);

      return {
        name: node.id,
        attributes: {
          label: node.attrs.label ?? node.id,
          fontname:
            "Avenir Next, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif",
          fontsize: "12",
          ...nodeTheme,
        },
      };
    }),
    edges: parsed.edges.map((edge) =>
      edge.label
        ? {
            tail: edge.from,
            head: edge.to,
            attributes: {
              label: edge.label,
            },
          }
        : {
            tail: edge.from,
            head: edge.to,
          },
    ),
  };
}

let vizPromise: Promise<Viz> | null = null;

function getViz() {
  vizPromise ??= instance();
  return vizPromise;
}

function formatIssues(errors: RenderError[]) {
  return errors
    .map((error) => error.message.trim())
    .filter(Boolean);
}

export default function SkillFlowStudio({
  initialDot = DEFAULT_SKILL_FLOW_DOT,
}: SkillFlowStudioProps) {
  const [source, setSource] = useState(initialDot);
  const [zoom, setZoom] = useState(1);
  const [graphvizVersion, setGraphvizVersion] = useState<string | null>(null);
  const [renderState, setRenderState] = useState<RenderState>(DEFAULT_RENDER_STATE);
  const [lastRenderedSource, setLastRenderedSource] = useState("");

  const deferredSource = useDeferredValue(source);
  const analysis = parseSkillFlowDot(deferredSource);
  const effectiveRenderState = deferredSource.trim()
    ? renderState
    : DEFAULT_RENDER_STATE;
  const graphvizMessages = formatIssues(effectiveRenderState.errors);
  const isStale = source !== deferredSource;
  const isRendering =
    deferredSource.trim().length > 0 && lastRenderedSource !== deferredSource;

  useEffect(() => {
    let cancelled = false;
    const renderInput = buildStyledGraph(deferredSource);

    if (!deferredSource.trim()) {
      return () => {
        cancelled = true;
      };
    }

    void getViz()
      .then((viz) => {
        if (cancelled) {
          return;
        }

        setGraphvizVersion(viz.graphvizVersion);

        const finalResult = viz.render(renderInput, {
          format: "svg",
          ...GRAPHVIZ_OPTIONS,
        });

        if (cancelled) {
          return;
        }

        if (finalResult.status === "success") {
          setRenderState({
            status: "success",
            svg: finalResult.output,
            errors: finalResult.errors,
          });
          setLastRenderedSource(deferredSource);
          return;
        }

        setRenderState({
          status: "failure",
          svg: "",
          errors: finalResult.errors,
        });
        setLastRenderedSource(deferredSource);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Graphviz 渲染阶段抛出了未知错误。";

        setRenderState({
          status: "failure",
          svg: "",
          errors: [
            {
              level: "error",
              message,
            },
          ],
        });
        setLastRenderedSource(deferredSource);
      });

    return () => {
      cancelled = true;
    };
  }, [deferredSource]);

  const renderStatus =
    effectiveRenderState.status === "failure"
      ? "渲染失败"
      : effectiveRenderState.status === "success"
        ? "已渲染"
        : isRendering || isStale
          ? "正在更新"
          : "等待输入";

  const metricCards = [
    {
      label: "节点",
      value: String(analysis.summary.nodeCount),
      note: analysis.summary.implicitNodeCount
        ? `隐式补全 ${analysis.summary.implicitNodeCount}`
        : "全部已声明",
    },
    {
      label: "连线",
      value: String(analysis.summary.edgeCount),
      note: `${analysis.summary.branchingCount} 个分叉点`,
    },
    {
      label: "层级",
      value: String(analysis.summary.layerCount),
      note: analysis.hasCycle ? "检测到循环" : "按流向分层",
    },
    {
      label: "入口 / 出口",
      value: `${analysis.roots.length} / ${analysis.terminals.length}`,
      note: `${analysis.name} · ${graphvizVersion ?? "Graphviz 准备中"}`,
    },
  ];

  const shapeSummary = Object.entries(analysis.summary.shapes)
    .map(([shape, count]) => `${shape} ${count}`)
    .join(" · ");

  const canDownload =
    effectiveRenderState.status === "success" &&
    Boolean(effectiveRenderState.svg);

  return (
    <main className="min-h-screen bg-[var(--background)] px-3 py-3 sm:px-4 lg:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1600px] flex-col gap-4">
        <section className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
          <div className="grid gap-6 px-5 py-5 lg:grid-cols-[1.05fr_0.95fr] lg:px-6">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--background-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--muted-strong)]">
                skill_flow parser
              </div>
              <div className="space-y-4">
                <h1 className="max-w-4xl text-3xl font-bold leading-tight tracking-[-0.03em] text-[var(--foreground)] sm:text-4xl">
                  skill_flow
                  <span className="mx-2 text-[var(--muted)]">—</span>
                  DOT 流程图可视化
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
                  维持 Graphviz 自动布局，但把视觉风格切到更接近你给的示例：浅灰背景、白色画布、蓝色终态、绿色操作、黄色判断、红色边标签。
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-[var(--muted-strong)]">
                <span className="rounded-full border border-[var(--line)] bg-[var(--background-soft)] px-3 py-1.5">
                  `digraph`
                </span>
                <span className="rounded-full border border-[var(--line)] bg-[var(--background-soft)] px-3 py-1.5">
                  `shape=diamond|box|doublecircle`
                </span>
                <span className="rounded-full border border-[var(--line)] bg-[var(--background-soft)] px-3 py-1.5">
                  `label=&quot;是 / 否&quot;`
                </span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {metricCards.map((card) => (
                <article
                  key={card.label}
                  className="rounded-[16px] border border-[var(--line)] bg-[var(--background-soft)] p-4"
                >
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                    {card.label}
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                    {card.value}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
                    {card.note}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid flex-1 gap-4 lg:grid-cols-[minmax(380px,0.92fr)_minmax(420px,1.08fr)]">
          <article className="flex min-h-[720px] flex-col overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                  源文本
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                  DOT 输入区
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSource(DEFAULT_SKILL_FLOW_DOT)}
                  className="rounded-full border border-[var(--line)] bg-[var(--background-soft)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-white"
                >
                  载入示例
                </button>
                <button
                  type="button"
                  onClick={() => setSource("")}
                  className="rounded-full border border-[#2563eb] bg-[#2563eb] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d4ed8]"
                >
                  清空
                </button>
              </div>
            </div>

            <div className="flex-1 p-4">
              <textarea
                value={source}
                onChange={(event) => setSource(event.target.value)}
                spellCheck={false}
                className="h-full min-h-[420px] w-full resize-none rounded-[16px] border border-[var(--line)] bg-[#ffffff] px-4 py-4 font-mono text-[13px] leading-6 text-[#334155] outline-none transition placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                placeholder={`digraph skill_flow {\n  "开始" [shape=doublecircle];\n  "判断" [shape=diamond];\n  "开始" -> "判断" [label="继续"];\n}`}
              />
            </div>

            <div className="grid gap-4 border-t border-[var(--line)] px-5 py-4 md:grid-cols-2">
              <div className="rounded-[16px] border border-[var(--line)] bg-[var(--background-soft)] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  解析摘要
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">
                  图名为 <strong>{analysis.name}</strong>，包含{" "}
                  <strong>{analysis.summary.nodeCount}</strong> 个节点、{" "}
                  <strong>{analysis.summary.edgeCount}</strong> 条连线。
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted-strong)]">
                  {shapeSummary || "暂无 shape 信息"}。
                </p>
              </div>
              <div className="rounded-[16px] border border-[var(--line)] bg-[var(--background-soft)] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  节点脉络
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">
                  入口：{analysis.roots.join("、") || "无"}。
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--foreground)]">
                  出口：{analysis.terminals.join("、") || "无"}。
                </p>
              </div>
            </div>
          </article>

          <article className="flex min-h-[720px] flex-col overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                  渲染结果
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                  SVG 流程图
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--line)] bg-[var(--background-soft)] px-3 py-1.5 text-xs font-medium text-[var(--muted-strong)]">
                  {renderStatus}
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((current) => Math.max(0.5, current - 0.1))}
                  className="rounded-full border border-[var(--line)] bg-[var(--background-soft)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-white"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="rounded-full border border-[var(--line)] bg-[var(--background-soft)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-white"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((current) => Math.min(2.4, current + 0.1))}
                  className="rounded-full border border-[var(--line)] bg-[var(--background-soft)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-white"
                >
                  +
                </button>
                <button
                  type="button"
                  disabled={!canDownload}
                  onClick={() => {
                    if (!canDownload) {
                      return;
                    }

                    const blob = new Blob([effectiveRenderState.svg], {
                      type: "image/svg+xml;charset=utf-8",
                    });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `${analysis.name || "skill-flow"}.svg`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="rounded-full border border-[#2563eb] bg-[#2563eb] px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:border-[var(--line)] disabled:bg-[var(--line)]"
                >
                  下载 SVG
                </button>
              </div>
            </div>

            <div className="flex-1 p-4">
              <div className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--preview)] shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
                <div className="border-b border-[var(--line)] px-4 py-3 text-xs tracking-[0.22em] text-[var(--muted)] uppercase">
                  graphviz / dot engine
                </div>
                <div className="graphviz-stage flex-1 overflow-auto p-6">
                  {effectiveRenderState.status === "success" ? (
                    <div
                      style={{
                        transform: `scale(${zoom})`,
                        transformOrigin: "top left",
                        width: "max-content",
                      }}
                      dangerouslySetInnerHTML={{
                        __html: effectiveRenderState.svg,
                      }}
                    />
                  ) : (
                    <div className="flex h-full min-h-[340px] items-center justify-center px-6 text-center">
                      <div className="max-w-md space-y-3">
                        <p className="text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                          {effectiveRenderState.status === "failure"
                            ? "Graphviz 没能完成这次布局。"
                            : "在这里看流程图。"}
                        </p>
                        <p className="text-sm leading-7 text-[var(--muted-strong)]">
                          {effectiveRenderState.status === "failure"
                            ? "先修正下方错误，或者回退到一个更小的 DOT 片段逐步排查。"
                            : "输入合法的 `digraph` 后，这里会自动生成 SVG 预览。"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="border-t border-[var(--line)] px-4 py-2 text-center text-xs text-[var(--muted)]">
                  基于 DOT (Graphviz) 源码渲染
                </div>
              </div>
            </div>

            <div className="grid gap-4 border-t border-[var(--line)] px-5 py-4 md:grid-cols-2">
              <div className="rounded-[16px] border border-[var(--line)] bg-[var(--background-soft)] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  解析器提示
                </p>
                <div className="mt-3 space-y-2">
                  {analysis.issues.length > 0 ? (
                    analysis.issues.map((issue) => (
                      <p
                        key={`${issue.line}-${issue.message}`}
                        className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900"
                      >
                        第 {issue.line} 行：{issue.message}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm leading-7 text-[var(--muted-strong)]">
                      当前文本能被页面内置解析器正常拆成节点和连线。
                    </p>
                  )}
                </div>
              </div>
              <div className="rounded-[16px] border border-[var(--line)] bg-[var(--background-soft)] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  Graphviz 反馈
                </p>
                <div className="mt-3 space-y-2">
                  {graphvizMessages.length > 0 ? (
                    graphvizMessages.map((message, index) => (
                      <p
                        key={`${index}-${message}`}
                        className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm leading-6 text-stone-800"
                      >
                        {message}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm leading-7 text-[var(--muted-strong)]">
                      当前没有 Graphviz warning。默认使用 `dot` 引擎做分层布局。
                    </p>
                  )}
                </div>
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
