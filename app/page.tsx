import type { Metadata } from "next";
import SkillFlowStudio from "@/components/skill-flow-studio";
import { DEFAULT_SKILL_FLOW_DOT } from "@/lib/skill-flow";

export const metadata: Metadata = {
  title: "Skill Flow Parser",
  description: "输入 DOT / Graphviz 文本，实时渲染 agent skill flow。",
};

export default function Home() {
  return <SkillFlowStudio initialDot={DEFAULT_SKILL_FLOW_DOT} />;
}
