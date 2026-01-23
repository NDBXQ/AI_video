"use server"

import { revalidatePath } from "next/cache"
import { getDb } from "coze-coding-dev-sdk"
import { publicResources, insertPublicResourceSchema } from "@/shared/schema"
import { uploadPublicFile } from "@/shared/storage"

export async function uploadPublicResource(formData: FormData) {
  try {
    const file = formData.get("file") as File
    const type = formData.get("type") as string
    const name = formData.get("name") as string
    const description = formData.get("description") as string
    const tagsStr = formData.get("tags") as string
    const scenesStr = formData.get("applicableScenes") as string

    if (!file) throw new Error("No file provided")

    // Upload to S3
    const { url, key } = await uploadPublicFile(file, `public/${type}`)

    // Parse metadata
    const tags = tagsStr ? tagsStr.split(",").map(t => t.trim()).filter(Boolean) : []
    const applicableScenes = scenesStr ? scenesStr.split(",").map(t => t.trim()).filter(Boolean) : []
    const resourceName = name || file.name.split(".")[0]

    // Validate payload
    const payload = insertPublicResourceSchema.parse({
      type,
      source: "upload",
      name: resourceName,
      description: description || "",
      previewUrl: url,
      previewStorageKey: key,
      originalUrl: url,
      originalStorageKey: key,
      tags,
      applicableScenes
    })

    // Insert to DB
    const db = await getDb({ publicResources })
    await db.insert(publicResources).values(payload)

    revalidatePath("/library")
    
    return { success: true }
  } catch (error) {
    console.error("Failed to upload public resource:", error)
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "Upload failed" 
    }
  }
}
