import "server-only"

import { DynamicStructuredTool } from "@langchain/core/tools"
import { z } from "zod"
import { discoverAgentSkills, loadAgentSkillMarkdown } from "./agentSkills"

export async function createDefaultAgentTools(): Promise<DynamicStructuredTool[]> {
  const skills = await discoverAgentSkills()

  const loadSkillTool = new DynamicStructuredTool({
    name: "load_skill_instructions",
    description:
      "加载指定 skill 的 SKILL.md 指令内容。仅当用户请求与该 skill 强相关时使用。",
    schema: z.object({
      skill: z.string().trim().min(1).max(200)
    }),
    func: async (input) => {
      const { skill } = input as { skill: string }
      const { content, directory } = await loadAgentSkillMarkdown(skill)
      return JSON.stringify({ skillDirectory: directory, content })
    }
  })

  const listSkillsTool = new DynamicStructuredTool({
    name: "list_skills",
    description: "列出当前可用的 skills（只返回 name/description）。",
    schema: z.object({}),
    func: async () => {
      return JSON.stringify({
        skills: skills.map((s) => ({ name: s.name, description: s.description }))
      })
    }
  })

  const getTimeTool = new DynamicStructuredTool({
    name: "get_server_time",
    description: "获取服务端当前时间（ISO 字符串）。",
    schema: z.object({}),
    func: async () => JSON.stringify({ now: new Date().toISOString() })
  })

  return [loadSkillTool, listSkillsTool, getTimeTool]
}
