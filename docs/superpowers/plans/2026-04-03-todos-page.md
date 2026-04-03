# 待办页实现计划

> **给代理执行者：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐步实现本计划。步骤使用复选框语法 `- [ ]` 进行跟踪。

**目标：** 在保留现有流程图首页的前提下，为项目新增一个基于 Prisma + SQLite 的 `/todos` 待办页，并提供顶部双导航、真实数据持久化、创建任务、切换状态和按条件筛选能力。

**架构：** 根布局保持 Server Component，只把需要路由感知的顶部导航做成小型 Client Component。`/todos` 页面用 async Server Component 读取数据库并把结果交给同步的页面壳组件渲染；这样既符合 Next 16 App Router 的数据流，也能绕开 Next 官方 Vitest 指南中对 async Server Component 单测支持不足的问题。写操作通过 Server Actions 处理，筛选通过 URL query 保持可刷新和可分享。

**技术栈：** Next.js 16.2 App Router、React 19、Tailwind CSS 4、Prisma + SQLite、Zod、Vitest、Testing Library

---

## 文件地图

### 新建

- `.env.example`
  - 本地数据库连接字符串示例
- `prisma.config.ts`
  - Prisma 7 配置，负责读取 `DATABASE_URL`
- `prisma/schema.prisma`
  - `Todo` 数据模型和枚举定义
- `vitest.config.mts`
  - Vitest + jsdom + path alias 配置
- `vitest.setup.ts`
  - Testing Library 的 DOM 匹配器初始化
- `lib/prisma.ts`
  - Prisma Client 单例
- `lib/todos/constants.ts`
  - 任务状态、优先级、分类常量和中文标签
- `lib/todos/queries.ts`
  - 任务筛选解析、查询、创建、状态更新、摘要聚合
- `lib/todos/schemas.ts`
  - Server Action 的 Zod 校验
- `components/top-nav.tsx`
  - 顶部双导航，基于当前 pathname 高亮
- `components/todos/todo-summary-cards.tsx`
  - 摘要卡片区
- `components/todos/todo-filters.tsx`
  - 基于 GET 表单的筛选区
- `components/todos/todo-create-form.tsx`
  - 基于 `useActionState` 的内联新建任务表单
- `components/todos/todo-list.tsx`
  - 任务列表容器
- `components/todos/todo-list-item.tsx`
  - 单行任务项，内含状态切换表单
- `components/todos/todo-page-content.tsx`
  - `/todos` 页面同步壳组件
- `app/todos/actions.ts`
  - 创建任务和切换状态的 Server Actions
- `app/todos/page.tsx`
  - `/todos` 路由入口，读取 `searchParams` 并拉取数据库数据
- `__tests__/lib/todos/queries.test.ts`
  - 数据层测试
- `__tests__/components/top-nav.test.tsx`
  - 顶部导航测试
- `__tests__/components/todos/todo-page-content.test.tsx`
  - 页面壳组件测试
- `__tests__/app/todos/actions.test.ts`
  - Server Actions 测试

### 修改

- `package.json`
  - 加入 Prisma、Zod、Vitest 依赖和脚本
- `app/layout.tsx`
  - 接入共享顶部导航

### 生成

- `generated/prisma/**/*`
  - `pnpm prisma generate` 生成的 Prisma Client；不手改，只在命令步骤中生成
- `prisma/dev.db`
  - 本地 SQLite 数据文件；由 `pnpm prisma:push` 生成

## 任务 1：搭建 Prisma 和测试工具链

**涉及文件：**
- 修改：`package.json`
- 新建：`.env.example`
- 新建：`prisma.config.ts`
- 新建：`prisma/schema.prisma`
- 新建：`vitest.config.mts`
- 新建：`vitest.setup.ts`

- [ ] **步骤 1：加入 Prisma、Zod 和测试依赖**

执行：

```bash
pnpm add @prisma/client zod
pnpm add -D prisma vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom vite-tsconfig-paths
```

然后更新 `package.json`：

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest",
    "test:run": "vitest run",
    "prisma:generate": "prisma generate",
    "prisma:push": "prisma db push",
    "postinstall": "prisma generate"
  }
}
```

- [ ] **步骤 2：创建 Prisma 和 Vitest 配置文件**

创建 `.env.example`：

```dotenv
DATABASE_URL="file:./prisma/dev.db"
```

创建 `prisma.config.ts`：

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

创建 `prisma/schema.prisma`：

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "sqlite"
}

enum TodoStatus {
  todo
  in_progress
  done
}

enum TodoPriority {
  high
  medium
  low
}

enum TodoCategory {
  development
  product
  design
  operations
}

model Todo {
  id        String       @id @default(cuid())
  title     String
  status    TodoStatus   @default(todo)
  priority  TodoPriority
  category  TodoCategory
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
}
```

创建 `vitest.config.mts`：

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["__tests__/**/*.test.ts", "__tests__/**/*.test.tsx"],
  },
});
```

创建 `vitest.setup.ts`：

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **步骤 3：创建本地环境文件**

执行：

```bash
cp .env.example .env
```

预期：本地生成 `.env` 文件，且它仍然被 git 忽略。

- [ ] **步骤 4：生成 Prisma Client 并创建 SQLite 数据库**

执行：

```bash
pnpm prisma:generate
pnpm prisma:push
```

预期：

- 成功生成 `generated/prisma/`
- Prisma 提示 SQLite 数据库结构已同步

- [ ] **步骤 5：在功能测试还没写之前先验证测试运行器已接通**

执行：

```bash
pnpm test:run
```

预期：出现类似 “No test files found” 的失败提示。这一步是合理的，因为测试框架已经接好，但功能测试还没创建。

- [ ] **步骤 6：提交脚手架改动**

```bash
git add package.json pnpm-lock.yaml .env.example prisma.config.ts prisma/schema.prisma vitest.config.mts vitest.setup.ts
git commit -m "chore: add prisma and vitest scaffolding"
```

## 任务 2：实现待办查询层和筛选解析

**涉及文件：**
- 新建：`lib/todos/constants.ts`
- 新建：`lib/todos/queries.ts`
- 测试：`__tests__/lib/todos/queries.test.ts`

- [ ] **步骤 1：先写会失败的数据层测试**

创建 `__tests__/lib/todos/queries.test.ts`：

```ts
import { describe, expect, it, vi } from "vitest";
import {
  createTodo,
  getTodoPageData,
  parseTodoFilters,
  updateTodoStatus,
} from "@/lib/todos/queries";

function createDbMock() {
  return {
    todo: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe("todo queries", () => {
  it("parses valid filters from search params", () => {
    expect(
      parseTodoFilters({
        status: "in_progress",
        priority: "high",
        category: "development",
      }),
    ).toEqual({
      status: "in_progress",
      priority: "high",
      category: "development",
    });
  });

  it("ignores unknown filter values", () => {
    expect(
      parseTodoFilters({
        status: "nope",
        priority: "wrong",
        category: "bad",
      }),
    ).toEqual({});
  });

  it("creates a todo with a trimmed title and default status", async () => {
    const db = createDbMock();
    await createTodo(db as never, {
      title: "  补齐 Prisma 配置  ",
      priority: "high",
      category: "development",
    });

    expect(db.todo.create).toHaveBeenCalledWith({
      data: {
        title: "补齐 Prisma 配置",
        status: "todo",
        priority: "high",
        category: "development",
      },
    });
  });

  it("updates only the todo status field", async () => {
    const db = createDbMock();
    await updateTodoStatus(db as never, "todo_1", "done");

    expect(db.todo.update).toHaveBeenCalledWith({
      where: { id: "todo_1" },
      data: { status: "done" },
    });
  });

  it("builds the filtered todo page query and summary", async () => {
    const db = createDbMock();
    db.todo.findMany.mockResolvedValue([
      {
        id: "todo_1",
        title: "完成任务页样式",
        status: "in_progress",
        priority: "high",
        category: "development",
        createdAt: new Date("2026-04-03T10:00:00.000Z"),
        updatedAt: new Date("2026-04-03T12:00:00.000Z"),
      },
    ]);
    db.todo.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const result = await getTodoPageData(db as never, {
      status: "in_progress",
      priority: "high",
      category: "development",
    });

    expect(db.todo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "in_progress",
          priority: "high",
          category: "development",
        },
      }),
    );
    expect(result.summary).toEqual({
      total: 3,
      inProgress: 1,
      done: 1,
    });
  });
});
```

- [ ] **步骤 2：运行测试并确认它确实失败**

执行：

```bash
pnpm test:run -- __tests__/lib/todos/queries.test.ts
```

预期：失败，因为 `@/lib/todos/queries` 还不存在。

- [ ] **步骤 3：编写最小可行的查询和筛选实现**

创建 `lib/todos/constants.ts`：

```ts
export const TODO_STATUSES = ["todo", "in_progress", "done"] as const;
export const TODO_PRIORITIES = ["high", "medium", "low"] as const;
export const TODO_CATEGORIES = [
  "development",
  "product",
  "design",
  "operations",
] as const;

export type TodoStatus = (typeof TODO_STATUSES)[number];
export type TodoPriority = (typeof TODO_PRIORITIES)[number];
export type TodoCategory = (typeof TODO_CATEGORIES)[number];

export const TODO_STATUS_LABELS: Record<TodoStatus, string> = {
  todo: "待开始",
  in_progress: "进行中",
  done: "已完成",
};

export const TODO_PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export const TODO_CATEGORY_LABELS: Record<TodoCategory, string> = {
  development: "开发",
  product: "产品",
  design: "设计",
  operations: "运营",
};
```

创建 `lib/todos/queries.ts`：

```ts
import type { Prisma, PrismaClient } from "@/generated/prisma";
import {
  TODO_CATEGORIES,
  TODO_PRIORITIES,
  TODO_STATUSES,
  type TodoCategory,
  type TodoPriority,
  type TodoStatus,
} from "@/lib/todos/constants";

export type TodoFilters = {
  status?: TodoStatus;
  priority?: TodoPriority;
  category?: TodoCategory;
};

export type TodoSummary = {
  total: number;
  inProgress: number;
  done: number;
};

type TodoDb = Pick<PrismaClient, "todo">;

function takeSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isStatus(value: string | undefined): value is TodoStatus {
  return Boolean(value && TODO_STATUSES.includes(value as TodoStatus));
}

function isPriority(value: string | undefined): value is TodoPriority {
  return Boolean(value && TODO_PRIORITIES.includes(value as TodoPriority));
}

function isCategory(value: string | undefined): value is TodoCategory {
  return Boolean(value && TODO_CATEGORIES.includes(value as TodoCategory));
}

export function parseTodoFilters(
  searchParams: Record<string, string | string[] | undefined>,
): TodoFilters {
  const status = takeSingle(searchParams.status);
  const priority = takeSingle(searchParams.priority);
  const category = takeSingle(searchParams.category);

  return {
    status: isStatus(status) ? status : undefined,
    priority: isPriority(priority) ? priority : undefined,
    category: isCategory(category) ? category : undefined,
  };
}

export function hasActiveFilters(filters: TodoFilters) {
  return Boolean(filters.status || filters.priority || filters.category);
}

function buildTodoWhere(filters: TodoFilters): Prisma.TodoWhereInput {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.category ? { category: filters.category } : {}),
  };
}

export async function getTodoPageData(db: TodoDb, filters: TodoFilters) {
  const where = buildTodoWhere(filters);
  const [todos, total, inProgress, done] = await Promise.all([
    db.todo.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
    }),
    db.todo.count(),
    db.todo.count({ where: { status: "in_progress" } }),
    db.todo.count({ where: { status: "done" } }),
  ]);

  return {
    todos,
    summary: {
      total,
      inProgress,
      done,
    } satisfies TodoSummary,
  };
}

export async function createTodo(
  db: TodoDb,
  input: {
    title: string;
    priority: TodoPriority;
    category: TodoCategory;
  },
) {
  return db.todo.create({
    data: {
      title: input.title.trim(),
      status: "todo",
      priority: input.priority,
      category: input.category,
    },
  });
}

export async function updateTodoStatus(
  db: TodoDb,
  todoId: string,
  status: TodoStatus,
) {
  return db.todo.update({
    where: { id: todoId },
    data: { status },
  });
}
```

- [ ] **步骤 4：再次运行数据层测试**

执行：

```bash
pnpm test:run -- __tests__/lib/todos/queries.test.ts
```

预期：通过。

- [ ] **步骤 5：提交查询层改动**

```bash
git add lib/todos/constants.ts lib/todos/queries.ts __tests__/lib/todos/queries.test.ts
git commit -m "feat: add todo query layer"
```

## 任务 3：加入共享导航和待办页页面壳

**涉及文件：**
- 新建：`components/top-nav.tsx`
- 新建：`components/todos/todo-summary-cards.tsx`
- 新建：`components/todos/todo-filters.tsx`
- 新建：`components/todos/todo-list.tsx`
- 新建：`components/todos/todo-list-item.tsx`
- 新建：`components/todos/todo-page-content.tsx`
- 修改：`app/layout.tsx`
- 测试：`__tests__/components/top-nav.test.tsx`
- 测试：`__tests__/components/todos/todo-page-content.test.tsx`

- [ ] **步骤 1：先写会失败的界面测试**

创建 `__tests__/components/top-nav.test.tsx`：

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TopNav from "@/components/top-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/todos",
}));

describe("TopNav", () => {
  it("renders the two shared navigation links and highlights the active one", () => {
    render(<TopNav />);

    expect(screen.getByRole("link", { name: "流程图页" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "待办页" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
```

创建 `__tests__/components/todos/todo-page-content.test.tsx`：

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TodoPageContent from "@/components/todos/todo-page-content";

const baseTodo = {
  id: "todo_1",
  title: "补齐任务页测试",
  status: "in_progress",
  priority: "high",
  category: "development",
  createdAt: new Date("2026-04-03T10:00:00.000Z"),
  updatedAt: new Date("2026-04-03T12:00:00.000Z"),
};

describe("TodoPageContent", () => {
  it("renders summary cards and todos", () => {
    render(
      <TodoPageContent
        filters={{}}
        summary={{ total: 3, inProgress: 1, done: 1 }}
        todos={[baseTodo]}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "待办任务" }),
    ).toBeInTheDocument();
    expect(screen.getByText("补齐任务页测试")).toBeInTheDocument();
    expect(screen.getByText("全部任务")).toBeInTheDocument();
  });

  it("shows the database empty state when there are no todos and no filters", () => {
    render(
      <TodoPageContent
        filters={{}}
        summary={{ total: 0, inProgress: 0, done: 0 }}
        todos={[]}
      />,
    );

    expect(screen.getByText("还没有任何任务")).toBeInTheDocument();
  });

  it("shows the filtered empty state when filters remove every result", () => {
    render(
      <TodoPageContent
        filters={{ status: "done" }}
        summary={{ total: 3, inProgress: 1, done: 1 }}
        todos={[]}
      />,
    );

    expect(screen.getByText("当前筛选条件下没有任务")).toBeInTheDocument();
  });
});
```

- [ ] **步骤 2：运行界面测试并确认失败**

执行：

```bash
pnpm test:run -- __tests__/components/top-nav.test.tsx __tests__/components/todos/todo-page-content.test.tsx
```

预期：失败，因为这些组件还不存在。

- [ ] **步骤 3：实现共享导航和同步页面壳**

创建 `components/top-nav.tsx`：

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "流程图页" },
  { href: "/todos", label: "待办页" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[color:rgba(250,249,247,0.9)] backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="text-sm font-semibold tracking-[0.16em] text-[var(--muted)]">
          NEXT APP
        </div>
        <div className="flex items-center gap-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "rounded-full border px-4 py-2 text-sm transition",
                  active
                    ? "border-[var(--accent)] bg-[var(--panel-strong)] text-[var(--foreground)]"
                    : "border-[var(--line)] text-[var(--muted-strong)] hover:border-[var(--line-strong)] hover:text-[var(--foreground)]",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
```

创建 `components/todos/todo-summary-cards.tsx`：

```tsx
import type { TodoSummary } from "@/lib/todos/queries";

export default function TodoSummaryCards({
  summary,
}: {
  summary: TodoSummary;
}) {
  const cards = [
    { label: "全部任务", value: summary.total },
    { label: "进行中", value: summary.inProgress },
    { label: "已完成", value: summary.done },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] px-5 py-4 shadow-[0_20px_50px_rgba(60,56,54,0.06)]"
        >
          <p className="text-sm text-[var(--muted)]">{card.label}</p>
          <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
            {card.value}
          </p>
        </article>
      ))}
    </section>
  );
}
```

创建 `components/todos/todo-filters.tsx`：

```tsx
import Link from "next/link";
import {
  TODO_CATEGORIES,
  TODO_CATEGORY_LABELS,
  TODO_PRIORITIES,
  TODO_PRIORITY_LABELS,
  TODO_STATUSES,
  TODO_STATUS_LABELS,
} from "@/lib/todos/constants";
import type { TodoFilters as TodoFilterValues } from "@/lib/todos/queries";

export default function TodoFilters({
  filters,
}: {
  filters: TodoFilterValues;
}) {
  return (
    <form
      action="/todos"
      className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_50px_rgba(60,56,54,0.06)]"
    >
      <div className="grid gap-4 md:grid-cols-4">
        <label className="flex flex-col gap-2 text-sm text-[var(--muted-strong)]">
          状态
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-[var(--foreground)]"
          >
            <option value="">全部</option>
            {TODO_STATUSES.map((status) => (
              <option key={status} value={status}>
                {TODO_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-[var(--muted-strong)]">
          优先级
          <select
            name="priority"
            defaultValue={filters.priority ?? ""}
            className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-[var(--foreground)]"
          >
            <option value="">全部</option>
            {TODO_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {TODO_PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-[var(--muted-strong)]">
          分类
          <select
            name="category"
            defaultValue={filters.category ?? ""}
            className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-[var(--foreground)]"
          >
            <option value="">全部</option>
            {TODO_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {TODO_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-3">
          <button
            type="submit"
            className="rounded-full bg-[var(--foreground)] px-4 py-2 text-sm text-white"
          >
            应用筛选
          </button>
          <Link
            href="/todos"
            className="rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--muted-strong)]"
          >
            清空
          </Link>
        </div>
      </div>
    </form>
  );
}
```

创建 `components/todos/todo-list-item.tsx`：

```tsx
import type { Todo } from "@/generated/prisma";
import {
  TODO_CATEGORY_LABELS,
  TODO_PRIORITY_LABELS,
  TODO_STATUS_LABELS,
} from "@/lib/todos/constants";

export default function TodoListItem({ todo }: { todo: Todo }) {
  return (
    <li className="grid gap-3 rounded-3xl border border-[var(--line)] bg-white px-5 py-4 md:grid-cols-[1.6fr_0.7fr_0.5fr_0.7fr] md:items-center">
      <div>
        <p className="text-base font-semibold text-[var(--foreground)]">
          {todo.title}
        </p>
      </div>
      <p className="text-sm text-[var(--muted-strong)]">
        {TODO_STATUS_LABELS[todo.status]}
      </p>
      <p className="text-sm text-[var(--muted-strong)]">
        {TODO_PRIORITY_LABELS[todo.priority]}
      </p>
      <p className="text-sm text-[var(--muted-strong)]">
        {TODO_CATEGORY_LABELS[todo.category]}
      </p>
    </li>
  );
}
```

创建 `components/todos/todo-list.tsx`：

```tsx
import type { Todo } from "@/generated/prisma";
import TodoListItem from "@/components/todos/todo-list-item";

export default function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul className="grid gap-4">
      {todos.map((todo) => (
        <TodoListItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
```

创建 `components/todos/todo-page-content.tsx`：

```tsx
import type { Todo } from "@/generated/prisma";
import TodoFilters from "@/components/todos/todo-filters";
import TodoList from "@/components/todos/todo-list";
import TodoSummaryCards from "@/components/todos/todo-summary-cards";
import { hasActiveFilters, type TodoFilters as TodoFilterValues, type TodoSummary } from "@/lib/todos/queries";

export default function TodoPageContent({
  filters,
  summary,
  todos,
}: {
  filters: TodoFilterValues;
  summary: TodoSummary;
  todos: Todo[];
}) {
  const emptyMessage = hasActiveFilters(filters)
    ? "当前筛选条件下没有任务"
    : "还没有任何任务";

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
          Project Console
        </p>
        <h1 className="text-4xl font-semibold text-[var(--foreground)]">
          待办任务
        </h1>
        <p className="max-w-2xl text-base text-[var(--muted-strong)]">
          管理当前项目的任务状态、优先级和固定分类。
        </p>
      </header>

      <TodoSummaryCards summary={summary} />
      <TodoFilters filters={filters} />

      <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_50px_rgba(60,56,54,0.06)]">
        {todos.length > 0 ? (
          <TodoList todos={todos} />
        ) : (
          <div className="rounded-3xl border border-dashed border-[var(--line-strong)] px-6 py-14 text-center text-[var(--muted-strong)]">
            {emptyMessage}
          </div>
        )}
      </section>
    </section>
  );
}
```

修改 `app/layout.tsx`：

```tsx
import type { Metadata } from "next";
import TopNav from "@/components/top-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Skill Flow Parser",
    template: "%s | Skill Flow Parser",
  },
  description: "DOT / Graphviz 解析与流程图预览页面。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <TopNav />
        <main className="flex min-h-[calc(100vh-73px)] flex-col">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **步骤 4：再次运行界面测试**

执行：

```bash
pnpm test:run -- __tests__/components/top-nav.test.tsx __tests__/components/todos/todo-page-content.test.tsx
```

预期：通过。

- [ ] **步骤 5：提交布局和页面壳改动**

```bash
git add app/layout.tsx components/top-nav.tsx components/todos/todo-summary-cards.tsx components/todos/todo-filters.tsx components/todos/todo-list.tsx components/todos/todo-list-item.tsx components/todos/todo-page-content.tsx __tests__/components/top-nav.test.tsx __tests__/components/todos/todo-page-content.test.tsx
git commit -m "feat: add todo page shell and shared navigation"
```

## 任务 4：加入 Server Actions、交互表单和 `/todos` 路由

**涉及文件：**
- 新建：`lib/prisma.ts`
- 新建：`lib/todos/schemas.ts`
- 新建：`app/todos/actions.ts`
- 新建：`components/todos/todo-create-form.tsx`
- 新建：`app/todos/page.tsx`
- 修改：`components/todos/todo-list-item.tsx`
- 修改：`components/todos/todo-page-content.tsx`
- 测试：`__tests__/app/todos/actions.test.ts`

- [ ] **步骤 1：先写会失败的 Server Action 测试**

创建 `__tests__/app/todos/actions.test.ts`：

```ts
import { describe, expect, it, vi } from "vitest";
import {
  createTodoAction,
  initialCreateTodoActionState,
  updateTodoStatusAction,
} from "@/app/todos/actions";
import { createTodo, updateTodoStatus } from "@/lib/todos/queries";
import { revalidatePath } from "next/cache";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/lib/todos/queries", () => ({
  createTodo: vi.fn(),
  updateTodoStatus: vi.fn(),
}));

describe("todo actions", () => {
  it("returns a field error when the title is blank", async () => {
    const formData = new FormData();
    formData.set("title", "   ");
    formData.set("priority", "high");
    formData.set("category", "development");

    const state = await createTodoAction(
      initialCreateTodoActionState,
      formData,
    );

    expect(state.error).toBe("请输入任务标题");
    expect(createTodo).not.toHaveBeenCalled();
  });

  it("creates a todo and revalidates the todos page", async () => {
    const formData = new FormData();
    formData.set("title", "完善 Prisma 表单");
    formData.set("priority", "medium");
    formData.set("category", "product");

    const state = await createTodoAction(
      initialCreateTodoActionState,
      formData,
    );

    expect(state.error).toBeNull();
    expect(state.success).toBe(true);
    expect(createTodo).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/todos");
  });

  it("rejects invalid status updates", async () => {
    const formData = new FormData();
    formData.set("status", "wrong");

    await expect(
      updateTodoStatusAction("todo_1", formData),
    ).rejects.toThrow("非法的任务状态更新请求");
    expect(updateTodoStatus).not.toHaveBeenCalled();
  });

  it("updates a todo status and revalidates the page", async () => {
    const formData = new FormData();
    formData.set("status", "done");

    await updateTodoStatusAction("todo_1", formData);

    expect(updateTodoStatus).toHaveBeenCalledWith({}, "todo_1", "done");
    expect(revalidatePath).toHaveBeenCalledWith("/todos");
  });
});
```

- [ ] **步骤 2：运行 action 测试并确认失败**

执行：

```bash
pnpm test:run -- __tests__/app/todos/actions.test.ts
```

预期：失败，因为 action 文件和 Prisma 相关文件都还不存在。

- [ ] **步骤 3：实现 Prisma 访问层、校验、actions 和路由接线**

创建 `lib/prisma.ts`：

```ts
import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

创建 `lib/todos/schemas.ts`：

```ts
import { z } from "zod";
import {
  TODO_CATEGORIES,
  TODO_PRIORITIES,
  TODO_STATUSES,
} from "@/lib/todos/constants";

export const createTodoSchema = z.object({
  title: z.string().trim().min(1, "请输入任务标题"),
  priority: z.enum(TODO_PRIORITIES),
  category: z.enum(TODO_CATEGORIES),
});

export const updateTodoStatusSchema = z.object({
  todoId: z.string().min(1),
  status: z.enum(TODO_STATUSES),
});
```

创建 `app/todos/actions.ts`：

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createTodo, updateTodoStatus } from "@/lib/todos/queries";
import {
  createTodoSchema,
  updateTodoStatusSchema,
} from "@/lib/todos/schemas";

export type CreateTodoActionState = {
  error: string | null;
  success: boolean;
};

export const initialCreateTodoActionState: CreateTodoActionState = {
  error: null,
  success: false,
};

export async function createTodoAction(
  _prevState: CreateTodoActionState,
  formData: FormData,
): Promise<CreateTodoActionState> {
  const parsed = createTodoSchema.safeParse({
    title: formData.get("title"),
    priority: formData.get("priority"),
    category: formData.get("category"),
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.flatten().fieldErrors.title?.[0] ??
        "提交失败，请检查表单内容。",
      success: false,
    };
  }

  await createTodo(prisma, parsed.data);
  revalidatePath("/todos");

  return { error: null, success: true };
}

export async function updateTodoStatusAction(
  todoId: string,
  formData: FormData,
) {
  const parsed = updateTodoStatusSchema.safeParse({
    todoId,
    status: formData.get("status"),
  });

  if (!parsed.success) {
    throw new Error("非法的任务状态更新请求");
  }

  await updateTodoStatus(prisma, parsed.data.todoId, parsed.data.status);
  revalidatePath("/todos");
}
```

创建 `components/todos/todo-create-form.tsx`：

```tsx
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createTodoAction,
  initialCreateTodoActionState,
} from "@/app/todos/actions";
import {
  TODO_CATEGORIES,
  TODO_CATEGORY_LABELS,
  TODO_PRIORITIES,
  TODO_PRIORITY_LABELS,
} from "@/lib/todos/constants";

export default function TodoCreateForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createTodoAction,
    initialCreateTodoActionState,
  );

  useEffect(() => {
    if (!state.success) {
      return;
    }

    formRef.current?.reset();
    setOpen(false);
  }, [state.success]);

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white"
        >
          新建任务
        </button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_50px_rgba(60,56,54,0.06)]"
    >
      <div className="grid gap-4 md:grid-cols-[1.6fr_0.7fr_0.7fr_auto]">
        <label className="flex flex-col gap-2 text-sm text-[var(--muted-strong)]">
          标题
          <input
            required
            name="title"
            placeholder="例如：完成待办页集成"
            className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-[var(--foreground)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-[var(--muted-strong)]">
          优先级
          <select
            name="priority"
            defaultValue="medium"
            className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-[var(--foreground)]"
          >
            {TODO_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {TODO_PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-[var(--muted-strong)]">
          分类
          <select
            name="category"
            defaultValue="development"
            className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-[var(--foreground)]"
          >
            {TODO_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {TODO_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--muted-strong)]"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? "提交中..." : "提交任务"}
            </button>
          </div>
        </div>
      </div>
      <p className="mt-3 min-h-6 text-sm text-[#b04a3a]" aria-live="polite">
        {state.error}
      </p>
    </form>
  );
}
```

修改 `components/todos/todo-list-item.tsx`：

```tsx
import type { Todo } from "@/generated/prisma";
import { updateTodoStatusAction } from "@/app/todos/actions";
import {
  TODO_CATEGORY_LABELS,
  TODO_PRIORITY_LABELS,
  TODO_STATUSES,
  TODO_STATUS_LABELS,
} from "@/lib/todos/constants";

export default function TodoListItem({ todo }: { todo: Todo }) {
  const updateStatus = updateTodoStatusAction.bind(null, todo.id);

  return (
    <li className="grid gap-4 rounded-3xl border border-[var(--line)] bg-white px-5 py-4 md:grid-cols-[1.5fr_1.1fr_0.5fr_0.7fr] md:items-center">
      <div>
        <p className="text-base font-semibold text-[var(--foreground)]">
          {todo.title}
        </p>
      </div>

      <form action={updateStatus} className="flex flex-wrap gap-2">
        {TODO_STATUSES.map((status) => {
          const active = todo.status === status;
          return (
            <button
              key={status}
              type="submit"
              name="status"
              value={status}
              className={[
                "rounded-full border px-3 py-1.5 text-sm transition",
                active
                  ? "border-[var(--accent)] bg-[#f7efe0] text-[var(--foreground)]"
                  : "border-[var(--line)] text-[var(--muted-strong)] hover:border-[var(--line-strong)]",
              ].join(" ")}
            >
              {TODO_STATUS_LABELS[status]}
            </button>
          );
        })}
      </form>

      <p className="text-sm text-[var(--muted-strong)]">
        {TODO_PRIORITY_LABELS[todo.priority]}
      </p>
      <p className="text-sm text-[var(--muted-strong)]">
        {TODO_CATEGORY_LABELS[todo.category]}
      </p>
    </li>
  );
}
```

修改 `components/todos/todo-page-content.tsx`：

```tsx
import type { Todo } from "@/generated/prisma";
import TodoCreateForm from "@/components/todos/todo-create-form";
import TodoFilters from "@/components/todos/todo-filters";
import TodoList from "@/components/todos/todo-list";
import TodoSummaryCards from "@/components/todos/todo-summary-cards";
import {
  hasActiveFilters,
  type TodoFilters as TodoFilterValues,
  type TodoSummary,
} from "@/lib/todos/queries";

export default function TodoPageContent({
  filters,
  summary,
  todos,
}: {
  filters: TodoFilterValues;
  summary: TodoSummary;
  todos: Todo[];
}) {
  const emptyMessage = hasActiveFilters(filters)
    ? "当前筛选条件下没有任务"
    : "还没有任何任务";

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
          Project Console
        </p>
        <h1 className="text-4xl font-semibold text-[var(--foreground)]">
          待办任务
        </h1>
        <p className="max-w-2xl text-base text-[var(--muted-strong)]">
          管理当前项目的任务状态、优先级和固定分类。
        </p>
      </header>

      <TodoSummaryCards summary={summary} />
      <TodoCreateForm />
      <TodoFilters filters={filters} />

      <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_50px_rgba(60,56,54,0.06)]">
        {todos.length > 0 ? (
          <TodoList todos={todos} />
        ) : (
          <div className="rounded-3xl border border-dashed border-[var(--line-strong)] px-6 py-14 text-center text-[var(--muted-strong)]">
            {emptyMessage}
          </div>
        )}
      </section>
    </section>
  );
}
```

创建 `app/todos/page.tsx`：

```tsx
import type { Metadata } from "next";
import TodoPageContent from "@/components/todos/todo-page-content";
import { prisma } from "@/lib/prisma";
import { getTodoPageData, parseTodoFilters } from "@/lib/todos/queries";

export const metadata: Metadata = {
  title: "待办页",
  description: "项目任务管理页面。",
};

export default async function TodosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseTodoFilters(await searchParams);
  const { todos, summary } = await getTodoPageData(prisma, filters);

  return (
    <TodoPageContent filters={filters} summary={summary} todos={todos} />
  );
}
```

- [ ] **步骤 4：再次运行 action 测试和页面壳测试**

执行：

```bash
pnpm test:run -- __tests__/app/todos/actions.test.ts __tests__/components/todos/todo-page-content.test.tsx
```

预期：通过。

- [ ] **步骤 5：运行完整验证流程**

执行：

```bash
pnpm test:run
pnpm lint
pnpm build
```

预期：

- 所有测试通过
- ESLint 退出码为 0
- Next 构建成功

- [ ] **步骤 6：提交最终功能改动**

```bash
git add lib/prisma.ts lib/todos/schemas.ts app/todos/actions.ts app/todos/page.tsx components/todos/todo-create-form.tsx components/todos/todo-list-item.tsx components/todos/todo-page-content.tsx __tests__/app/todos/actions.test.ts
git commit -m "feat: add persisted todos page"
```

## 自检

- 规格覆盖：顶部双导航由任务 3 完成，`/todos` 路由与服务端读取由任务 4 完成，Prisma + SQLite 基础设施由任务 1 完成，创建任务 / 状态切换 / 筛选由任务 2 和任务 4 完成，测试覆盖由任务 2 到任务 4 完成。
- 占位符扫描：本计划未使用 `TODO`、`TBD`、`类似 Task N` 之类的占位描述。
- 类型一致性：数据层统一使用 `TodoStatus` / `TodoPriority` / `TodoCategory` 字面量类型；页面和 actions 共享同一组常量和 schema。
