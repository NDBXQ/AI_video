import { kickReferenceImageWorker } from "@/server/jobs/referenceImageWorker"
import { kickVideoGenerateWorker } from "@/server/jobs/videoGenerateWorker"
import { kickCozeStoryboardWorker } from "@/server/jobs/cozeStoryboardWorker"

export function kickAllWorkers(): void {
  kickReferenceImageWorker()
  kickVideoGenerateWorker()
  kickCozeStoryboardWorker()
}
