import { ImageGenerationService } from "@/server/domains/video-creation/services/imageGenerationService"

type PromptInput = {
  name: string
  prompt: string
  description?: string
  category: "background" | "role" | "item"
  generatedImageId?: string
}

type GenerateInput = {
  storyId?: string
  storyboardId?: string
  prompts: PromptInput[]
  forceRegenerate: boolean
  async: boolean
}

export async function generateVideoCreationImages(input: { userId: string; traceId: string; payload: GenerateInput }): Promise<
  | { ok: true; status: 200 | 202; data: unknown }
  | { ok: false; code: string; message: string; status: number }
> {
  try {
    const result = await ImageGenerationService.generateImages(input.userId, input.payload as any, input.traceId)
    if ((result as any)?.async) {
      return { ok: true, status: 202, data: { jobId: (result as any).jobId, status: (result as any).status } }
    }
    return { ok: true, status: 200, data: result }
  } catch (err) {
    const anyErr = err as { message?: string }
    if (anyErr?.message === "STORY_NOT_FOUND") {
      return { ok: false, code: "STORY_NOT_FOUND", message: "未找到可用的故事", status: 404 }
    }
    return { ok: false, code: "IMAGE_GENERATION_FAILED", message: anyErr?.message ?? "生成失败", status: 500 }
  }
}
