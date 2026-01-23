-- 数据库迁移脚本：将 sceneId 字段重命名为 storyboardId
-- 执行时间：2024
-- 涉及表：prompts, generated_images, generated_videos

-- 1. 重命名 prompts 表的 scene_id 列为 storyboard_id
ALTER TABLE prompts RENAME COLUMN scene_id TO storyboard_id;

-- 2. 重命名 prompts 表的索引
DROP INDEX IF EXISTS prompts_scene_id_idx;
CREATE INDEX prompts_storyboard_id_idx ON prompts USING btree (storyboard_id);

-- 3. 重命名 generated_images 表的 scene_id 列为 storyboard_id
ALTER TABLE generated_images RENAME COLUMN scene_id TO storyboard_id;

-- 4. 重命名 generated_images 表的索引
DROP INDEX IF EXISTS generated_images_scene_id_idx;
CREATE INDEX generated_images_storyboard_id_idx ON generated_images USING btree (storyboard_id);

-- 5. 重命名 generated_videos 表的 scene_id 列为 storyboard_id
ALTER TABLE generated_videos RENAME COLUMN scene_id TO storyboard_id;

-- 6. 重命名 generated_videos 表的索引
DROP INDEX IF EXISTS generated_videos_scene_id_idx;
CREATE INDEX generated_videos_storyboard_id_idx ON generated_videos USING btree (storyboard_id);

-- 完成
SELECT 'Migration completed: sceneId renamed to storyboardId in prompts, generated_images, generated_videos tables';
