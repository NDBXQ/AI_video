import { kickReferenceImageWorker } from "@/server/domains/video-creation/jobs/referenceImageWorker"
import { kickVideoGenerateWorker } from "@/server/domains/video-creation/jobs/videoGenerateWorker"
import { kickCozeStoryboardWorker } from "@/server/domains/storyboard/jobs/cozeStoryboardWorker"
import { kickTvcShotlistWorker } from "@/server/domains/tvc/jobs/tvcShotlistWorker"

export function kickAllWorkers(): void {
  kickReferenceImageWorker()
  kickVideoGenerateWorker()
  kickCozeStoryboardWorker()
  kickTvcShotlistWorker()
}
