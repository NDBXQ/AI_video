import type { TvcToolSpec } from "../llm/llmTypes"
import { VIBE_VIDEO_DURATION_MAX_SECONDS, VIBE_VIDEO_DURATION_MIN_SECONDS } from "../vibeCreatingConfig"
import { VIBE_SKILLS } from "./constants"
import { SEEDREAM_ALLOWED_SIZES } from "./validators/seedreamSize"

export function getVibeCreatingToolSpecs(): TvcToolSpec[] {
  return [
    {
      type: "function",
      function: {
        name: "load_skill_instructions",
        description: "加载技能指令（读取 skills/<skill>/SKILL.md 内容）",
        parameters: {
          type: "object",
          properties: {
            skill: { type: "string", enum: [...VIBE_SKILLS] }
          },
          required: ["skill"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
        name: "generate_images_batch",
        description:
          "批量生成图片（参考图/首帧图），使用 kind+ordinal 作为素材标识并建立映射关系。参考图（kind=reference_image）必须提供 category（role/background/item）与 name（对象名称），用于后续展示与编辑。首帧图需通过 reference_image_ordinals 指定输入参考图 ordinal 列表。默认禁止覆盖：当 overwrite_existing=false 且同 kind+ordinal 已存在时，将直接复用已存在资源，不会写入覆盖。返回每项生成结果 { ordinal, status, kind, url }（url 仅供模型内部使用，禁止在对话框展示内容中对用户输出）",
        parameters: {
          type: "object",
          properties: {
            requests: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  kind: { type: "string", enum: ["reference_image", "first_frame"] },
                  ordinal: { type: "number" },
                  category: { type: "string", enum: ["role", "background", "item"] },
                  name: { type: "string" },
                  description: { type: "string" },
                  prompt: { type: "string" },
                  reference_image_ordinals: { type: "array", items: { type: "number" } }
                },
                required: ["ordinal", "prompt"],
                additionalProperties: false
              }
            },
            overwrite_existing: { type: "boolean" },
            size: {
              type: "string",
              enum: [...SEEDREAM_ALLOWED_SIZES],
              description:
                "图片尺寸。可填比例：1:1/4:3/3:4/16:9/9:16/3:2/2:3/21:9；或填分辨率：2048x2048/2304x1728/1728x2304/2560x1440/1440x2560/2496x1664/1664x2496/3024x1296"
            }
          },
          required: ["requests"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
        name: "assets_resolve",
        description: "从数据库 assets 按 kind+ordinal 查询资源元信息与可访问 URL（用于模型内部理解与后续工具入参使用，严禁对用户输出 URL）",
        parameters: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["reference_image", "first_frame", "video_clip", "user_image"] },
            ordinal: { type: "number" }
          },
          required: ["kind", "ordinal"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
        name: "generate_videos_from_images_batch",
        description:
          "基于首帧图 ordinal 批量生成视频片段。每条请求必须提供输出 ordinal，并用 first_frame_ordinal 指定输入首帧 ordinal。默认禁止覆盖：当 overwrite_existing=false 且输出 ordinal 已存在时，将直接复用已存在资源，不会写入覆盖。返回每项生成结果 { ordinal, status, kind, url }（url 仅供模型内部使用，禁止在对话框展示内容中对用户输出）",
        parameters: {
          type: "object",
          properties: {
            requests: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  ordinal: { type: "number" },
                  first_frame_ordinal: { type: "number" },
                  description: { type: "string" },
                  prompt: { type: "string" },
                  duration_seconds: {
                    type: "number",
                    minimum: VIBE_VIDEO_DURATION_MIN_SECONDS,
                    maximum: VIBE_VIDEO_DURATION_MAX_SECONDS,
                    multipleOf: 1,
                    description: `视频时长（秒），必须为 ${VIBE_VIDEO_DURATION_MIN_SECONDS}~${VIBE_VIDEO_DURATION_MAX_SECONDS} 的整数`
                  }
                },
                required: ["ordinal", "first_frame_ordinal", "prompt", "duration_seconds"],
                additionalProperties: false
              }
            },
            overwrite_existing: { type: "boolean" },
            max_concurrent: { type: "number" }
          },
          required: ["requests"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
        name: "recommend_background_music",
        description: "推荐背景音乐风格（不生成文件）",
        parameters: {
          type: "object",
          properties: {
            scene_type: { type: "string" },
            mood: { type: "string" },
            duration_seconds: { type: "number" }
          },
          required: ["scene_type", "mood", "duration_seconds"],
          additionalProperties: false
        }
      }
    }
  ]
}
