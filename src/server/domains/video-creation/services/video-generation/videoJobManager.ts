import { enqueueVideoGenerateJob, kickVideoGenerateWorker } from "@/server/domains/video-creation/jobs/videoGenerateWorker"
import { GenerateVideoInput, GenerateVideoResult } from "./types"

export class VideoJobManager {
  static async enqueueJob(
    userId: string, 
    traceId: string, 
    input: GenerateVideoInput, 
    storyId: string | null, 
    storyboardId: string | null,
    resolvedMode: string,
    finalResolution: string,
    finalRatio: string,
    existingVideoStorageKey: string | null
  ): Promise<GenerateVideoResult> {
    const { prompt, duration, watermark, first_image, last_image, forceRegenerate, return_last_frame } = input
    const generateAudio = input.generate_audio ?? input.generateAudio ?? false
    
    const { jobId, snapshot } = await enqueueVideoGenerateJob({
        userId,
        traceId,
        storyId,
        storyboardId,
        prompt,
        mode: resolvedMode,
        ratio: finalRatio,
        resolution: finalResolution,
        duration,
        generateAudio,
        watermark,
        first_image,
        last_image: last_image ?? null,
        return_last_frame: return_last_frame ?? true,
        forceRegenerate: Boolean(forceRegenerate),
        existingVideoStorageKey
      })
      
      kickVideoGenerateWorker()
      
      return { async: true, jobId, status: snapshot.status }
  }
}
