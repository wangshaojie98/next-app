export const DEFAULT_SKILL_FLOW_DOT = `digraph skill_flow {
    "收到用户消息" [shape=doublecircle];
    "即将进入 PlanMode？" [shape=doublecircle];
    "已经 brainstorm 过了吗？" [shape=diamond];
    "调用 brainstorming skill" [shape=box];
    "是否有任何 skill 可能适用？" [shape=diamond];
    "调用 Skill 工具" [shape=box];
    "说明：'正在使用 [skill] 来 [目的]'" [shape=box];
    "是否带有 checklist？" [shape=diamond];
    "为每一项创建 TodoWrite todo" [shape=box];
    "严格按照 skill 执行" [shape=box];
    "回复（包括澄清）" [shape=doublecircle];

    "即将进入 PlanMode？" -> "已经 brainstorm 过了吗？";
    "已经 brainstorm 过了吗？" -> "调用 brainstorming skill" [label="否"];
    "已经 brainstorm 过了吗？" -> "是否有任何 skill 可能适用？" [label="是"];
    "调用 brainstorming skill" -> "是否有任何 skill 可能适用？";

    "收到用户消息" -> "是否有任何 skill 可能适用？";
    "是否有任何 skill 可能适用？" -> "调用 Skill 工具" [label="是，哪怕只有 1%"];
    "是否有任何 skill 可能适用？" -> "回复（包括澄清）" [label="确定不适用"];
    "调用 Skill 工具" -> "说明：'正在使用 [skill] 来 [目的]'";
    "说明：'正在使用 [skill] 来 [目的]'" -> "是否带有 checklist？";
    "是否带有 checklist？" -> "为每一项创建 TodoWrite todo" [label="是"];
    "是否带有 checklist？" -> "严格按照 skill 执行" [label="否"];
    "为每一项创建 TodoWrite todo" -> "严格按照 skill 执行";
}`;

export type SkillFlowAttributes = Record<string, string>;

export type SkillFlowIssue = {
  line: number;
  statement: string;
  message: string;
};

export type SkillFlowEdge = {
  id: string;
  from: string;
  to: string;
  attrs: SkillFlowAttributes;
  label: string | null;
  line: number;
  order: number;
};

export type SkillFlowNodeRole =
  | "start"
  | "decision"
  | "action"
  | "generic"
  | "implicit";

export type SkillFlowNode = {
  id: string;
  attrs: SkillFlowAttributes;
  shape: string;
  role: SkillFlowNodeRole;
  line: number | null;
  declared: boolean;
  indegree: number;
  outdegree: number;
  level: number;
  order: number;
  incoming: string[];
  outgoing: string[];
};

export type SkillFlowLayer = {
  level: number;
  nodeIds: string[];
};

export type SkillFlowGraph = {
  name: string;
  nodes: SkillFlowNode[];
  edges: SkillFlowEdge[];
  issues: SkillFlowIssue[];
  layers: SkillFlowLayer[];
  roots: string[];
  terminals: string[];
  hasCycle: boolean;
  summary: {
    nodeCount: number;
    edgeCount: number;
    layerCount: number;
    branchingCount: number;
    implicitNodeCount: number;
    shapes: Record<string, number>;
  };
};

type Statement = {
  text: string;
  line: number;
};

type NodeDraft = {
  id: string;
  attrs: SkillFlowAttributes;
  line: number | null;
  order: number;
  declared: boolean;
};

const DIGRAPH_PATTERN = /^\s*digraph\s+("[^"]+"|[A-Za-z_][\w]*)\s*\{([\s\S]*)\}\s*$/;
const EDGE_PATTERN = /^"([^"]+)"\s*->\s*"([^"]+)"(?:\s*\[([\s\S]*)\])?$/;
const NODE_PATTERN = /^"([^"]+)"(?:\s*\[([\s\S]*)\])?$/;

export function parseSkillFlowDot(input: string): SkillFlowGraph {
  const normalized = input.replace(/\r\n?/g, "\n");
  const issues: SkillFlowIssue[] = [];
  const graphMatch = normalized.match(DIGRAPH_PATTERN);

  let graphName = "untitled_flow";
  let body = normalized;

  if (graphMatch) {
    graphName = normalizeValue(graphMatch[1]);
    body = graphMatch[2];
  } else if (normalized.trim()) {
    issues.push({
      line: 1,
      statement: normalized.trim().slice(0, 120),
      message: "未检测到完整的 digraph 包裹，已按裸语句继续解析。",
    });
  }

  const statements = splitStatements(body);
  const nodes = new Map<string, NodeDraft>();
  const edges: SkillFlowEdge[] = [];

  const ensureNode = (id: string, line: number | null, declared: boolean) => {
    const existing = nodes.get(id);

    if (existing) {
      if (declared) {
        existing.declared = true;
      }

      if (line !== null && existing.line === null) {
        existing.line = line;
      }

      return existing;
    }

    const draft: NodeDraft = {
      id,
      attrs: {},
      line,
      order: nodes.size,
      declared,
    };

    nodes.set(id, draft);
    return draft;
  };

  statements.forEach((statement) => {
    if (statement.text.includes("->")) {
      const edgeMatch = statement.text.match(EDGE_PATTERN);

      if (!edgeMatch) {
        issues.push({
          line: statement.line,
          statement: statement.text,
          message: "无法识别 edge 语句，请检查箭头和属性格式。",
        });
        return;
      }

      const from = normalizeValue(edgeMatch[1]);
      const to = normalizeValue(edgeMatch[2]);
      const attrs = parseAttributes(edgeMatch[3], statement, issues);

      ensureNode(from, null, false);
      ensureNode(to, null, false);

      edges.push({
        id: `${from}->${to}-${edges.length}`,
        from,
        to,
        attrs,
        label: attrs.label ?? null,
        line: statement.line,
        order: edges.length,
      });

      return;
    }

    const nodeMatch = statement.text.match(NODE_PATTERN);

    if (!nodeMatch) {
      issues.push({
        line: statement.line,
        statement: statement.text,
        message: "无法识别 node 语句，请确认使用了引号和可选属性块。",
      });
      return;
    }

    const id = normalizeValue(nodeMatch[1]);
    const attrs = parseAttributes(nodeMatch[2], statement, issues);
    const node = ensureNode(id, statement.line, true);

    node.attrs = {
      ...node.attrs,
      ...attrs,
    };
    node.declared = true;
    node.line = statement.line;
  });

  const drafts = Array.from(nodes.values()).sort((left, right) => left.order - right.order);
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();

  drafts.forEach((node) => {
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
  });

  edges.forEach((edge) => {
    outgoing.get(edge.from)?.push(edge.to);
    incoming.get(edge.to)?.push(edge.from);
  });

  const indegrees = new Map<string, number>();
  const levels = new Map<string, number>();

  drafts.forEach((node) => {
    indegrees.set(node.id, incoming.get(node.id)?.length ?? 0);
    levels.set(node.id, 0);
  });

  const adjacency = new Map<string, SkillFlowEdge[]>();

  edges.forEach((edge) => {
    const bucket = adjacency.get(edge.from) ?? [];
    bucket.push(edge);
    adjacency.set(edge.from, bucket);
  });

  drafts.forEach((node) => {
    const bucket = adjacency.get(node.id);

    if (bucket) {
      bucket.sort((left, right) => left.order - right.order);
    }
  });

  const queue = drafts
    .filter((node) => (incoming.get(node.id)?.length ?? 0) === 0)
    .map((node) => node.id);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift();

    if (!currentId || visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);

    const currentLevel = levels.get(currentId) ?? 0;
    const outbound = adjacency.get(currentId) ?? [];

    outbound.forEach((edge) => {
      const nextLevel = Math.max(levels.get(edge.to) ?? 0, currentLevel + 1);
      levels.set(edge.to, nextLevel);

      const nextIndegree = (indegrees.get(edge.to) ?? 0) - 1;
      indegrees.set(edge.to, nextIndegree);

      if (nextIndegree === 0) {
        queue.push(edge.to);
      }
    });
  }

  const hasCycle = visited.size < drafts.length;

  if (hasCycle) {
    let fallbackLevel = Math.max(...Array.from(levels.values()), 0) + 1;

    drafts.forEach((node) => {
      if (visited.has(node.id)) {
        return;
      }

      levels.set(node.id, Math.max(levels.get(node.id) ?? 0, fallbackLevel));
      fallbackLevel += 1;
    });
  }

  const parsedNodes: SkillFlowNode[] = drafts.map((draft) => {
    const nodeIncoming = incoming.get(draft.id) ?? [];
    const nodeOutgoing = outgoing.get(draft.id) ?? [];
    const shape = draft.attrs.shape ?? (draft.declared ? "ellipse" : "implicit");

    return {
      id: draft.id,
      attrs: draft.attrs,
      shape,
      role: inferRole(shape, draft.declared),
      line: draft.line,
      declared: draft.declared,
      indegree: nodeIncoming.length,
      outdegree: nodeOutgoing.length,
      level: levels.get(draft.id) ?? 0,
      order: draft.order,
      incoming: nodeIncoming,
      outgoing: nodeOutgoing,
    };
  });

  const layersMap = new Map<number, string[]>();

  parsedNodes.forEach((node) => {
    const bucket = layersMap.get(node.level) ?? [];
    bucket.push(node.id);
    layersMap.set(node.level, bucket);
  });

  const layers = Array.from(layersMap.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([level, nodeIds]) => ({
      level,
      nodeIds: nodeIds.sort(
        (left, right) =>
          parsedNodes.find((node) => node.id === left)!.order -
          parsedNodes.find((node) => node.id === right)!.order,
      ),
    }));

  const shapes = parsedNodes.reduce<Record<string, number>>((accumulator, node) => {
    accumulator[node.shape] = (accumulator[node.shape] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    name: graphName,
    nodes: parsedNodes,
    edges,
    issues,
    layers,
    roots: parsedNodes.filter((node) => node.indegree === 0).map((node) => node.id),
    terminals: parsedNodes.filter((node) => node.outdegree === 0).map((node) => node.id),
    hasCycle,
    summary: {
      nodeCount: parsedNodes.length,
      edgeCount: edges.length,
      layerCount: layers.length,
      branchingCount: parsedNodes.filter((node) => node.outdegree > 1).length,
      implicitNodeCount: parsedNodes.filter((node) => !node.declared).length,
      shapes,
    },
  };
}

function splitStatements(body: string): Statement[] {
  const statements: Statement[] = [];
  let buffer = "";
  let inQuote = false;
  let bracketDepth = 0;
  let line = 1;
  let statementLine = 1;
  let hasContent = false;

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    const previous = body[index - 1];

    if (!hasContent && !/\s/.test(char)) {
      statementLine = line;
      hasContent = true;
    }

    if (char === '"' && previous !== "\\") {
      inQuote = !inQuote;
    } else if (!inQuote && char === "[") {
      bracketDepth += 1;
    } else if (!inQuote && char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
    }

    if (char === ";" && !inQuote && bracketDepth === 0) {
      const text = buffer.trim();

      if (text) {
        statements.push({
          text,
          line: statementLine,
        });
      }

      buffer = "";
      hasContent = false;
      continue;
    }

    buffer += char;

    if (char === "\n") {
      line += 1;
    }
  }

  const trailing = buffer.trim();

  if (trailing) {
    statements.push({
      text: trailing,
      line: statementLine,
    });
  }

  return statements;
}

function parseAttributes(
  source: string | undefined,
  statement: Statement,
  issues: SkillFlowIssue[],
): SkillFlowAttributes {
  if (!source) {
    return {};
  }

  const attrs: SkillFlowAttributes = {};
  const parts = splitAttributeParts(source);

  parts.forEach((part) => {
    const segment = part.trim();

    if (!segment) {
      return;
    }

    const match = segment.match(/^([A-Za-z_][\w-]*)\s*=\s*([\s\S]+)$/);

    if (!match) {
      issues.push({
        line: statement.line,
        statement: statement.text,
        message: `属性片段无法解析：${segment}`,
      });
      return;
    }

    attrs[match[1]] = normalizeValue(match[2]);
  });

  return attrs;
}

function splitAttributeParts(source: string): string[] {
  const parts: string[] = [];
  let buffer = "";
  let inQuote = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];

    if (char === '"' && previous !== "\\") {
      inQuote = !inQuote;
    }

    if (char === "," && !inQuote) {
      parts.push(buffer);
      buffer = "";
      continue;
    }

    buffer += char;
  }

  if (buffer.trim()) {
    parts.push(buffer);
  }

  return parts;
}

function normalizeValue(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"');
  }

  return trimmed;
}

function inferRole(shape: string, declared: boolean): SkillFlowNodeRole {
  if (!declared) {
    return "implicit";
  }

  if (shape === "doublecircle") {
    return "start";
  }

  if (shape === "diamond") {
    return "decision";
  }

  if (shape === "box") {
    return "action";
  }

  return "generic";
}
