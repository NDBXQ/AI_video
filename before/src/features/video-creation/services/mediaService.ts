/**
 * 媒体素材服务
 * 处理媒体素材的上传、查询、删除等操作
 */

import { MediaItem, MediaType, MediaGenerateRequest } from '../domain/mediaTypes';

const BASE_URL = '/api/video-creation/media';

export class MediaService {
  /**
   * 获取媒体素材列表
   */
  static async getMediaList(type: MediaType, searchQuery?: string): Promise<MediaItem[]> {
    try {
      console.log('[MediaService] 获取媒体列表:', type, searchQuery);

      const params = new URLSearchParams({
        type,
      });

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await fetch(`${BASE_URL}?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`获取失败: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('获取媒体列表失败:', error);
      return [];
    }
  }

  /**
   * 生成媒体素材
   */
  static async generateMedia(request: MediaGenerateRequest): Promise<MediaItem[]> {
    try {
      console.log('[MediaService] 生成媒体:', request);

      const response = await fetch(`${BASE_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '生成失败');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('生成媒体失败:', error);
      throw error;
    }
  }

  /**
   * 上传媒体素材
   */
  static async uploadMedia(
    type: MediaType,
    file: File
  ): Promise<MediaItem> {
    try {
      console.log('[MediaService] 上传媒体:', type, file.name);

      const formData = new FormData();
      formData.append('type', type);
      formData.append('file', file);

      const response = await fetch(`${BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`上传失败: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('上传媒体失败:', error);
      throw error;
    }
  }

  /**
   * 删除媒体素材
   */
  static async deleteMedia(mediaId: string): Promise<boolean> {
    try {
      console.log('[MediaService] 删除媒体:', mediaId);

      const response = await fetch(`${BASE_URL}/${mediaId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`删除失败: ${response.status}`);
      }

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('删除媒体失败:', error);
      throw error;
    }
  }

  /**
   * 点赞/取消点赞媒体素材
   */
  static async toggleLikeMedia(mediaId: string, liked: boolean): Promise<boolean> {
    try {
      console.log('[MediaService] 切换点赞:', mediaId, liked);

      const response = await fetch(`${BASE_URL}/${mediaId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ liked }),
      });

      if (!response.ok) {
        throw new Error(`操作失败: ${response.status}`);
      }

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('切换点赞失败:', error);
      throw error;
    }
  }

  /**
   * 根据分镜脚本生成图片提示词
   */
  static generateImagePromptFromScene(scene: any): string {
    if (!scene.generatedScript) {
      return scene.content;
    }

    const scriptData = scene.generatedScript;
    if (scriptData.video_content?.background?.description) {
      return scriptData.video_content.background.description;
    }

    if (scriptData.video_script?.shot_content?.background?.background_name) {
      return scriptData.video_script.shot_content.background.background_name;
    }

    return scene.content;
  }

  /**
   * 根据分镜脚本生成视频提示词（动作+镜头运动）
   */
  static generateVideoPromptFromScene(scene: any): string {
    if (!scene.generatedScript) {
      return scene.content;
    }

    const scriptData = scene.generatedScript;
    const shotContent = scriptData.video_script?.shot_content;

    if (!shotContent) {
      return scene.content;
    }

    // 提取角色动作
    const roles = shotContent.roles || [];
    const actions = roles.map((role: any) => {
      const roleName = role.role_name || '';
      const action = role.action || '';
      const expression = role.expression || '';
      return `${roleName}: ${action}，表情：${expression}`;
    }).join('；');

    // 提取镜头运动
    const shoot = shotContent.shoot || {};
    const angle = shoot.angle || '';
    const cameraMovement = shoot.camera_movement || '';
    const shotAngle = shoot.shot_angle || '';

    // 组合成提示词
    let prompt = actions;
    if (angle || cameraMovement || shotAngle) {
      prompt += `。镜头：${shotAngle}，角度：${angle}，运动：${cameraMovement}`;
    }

    return prompt || scene.content;
  }

  /**
   * 根据分镜脚本生成音频提示词（说话内容）
   */
  static generateAudioPromptFromScene(scene: any): string {
    if (!scene.generatedScript) {
      return '';
    }

    const scriptData = scene.generatedScript;
    const shotContent = scriptData.video_script?.shot_content;

    if (!shotContent) {
      return '';
    }

    // 提取说话内容
    const roles = shotContent.roles || [];
    const speakParts = roles
      .filter((role: any) => role.speak && role.speak.content)
      .map((role: any) => {
        const roleName = role.role_name || '';
        const speak = role.speak;
        const tone = speak.tone || '';
        const content = speak.content || '';
        const speed = speak.speed || 1;
        const emotion = speak.emotion || '';

        return {
          roleName,
          content,
          tone,
          speed,
          emotion,
        };
      });

    return JSON.stringify(speakParts);
  }

  /**
   * 获取分镜的BGM信息
   */
  static getSceneBGM(scene: any): string | null {
    if (!scene.generatedScript) {
      return null;
    }

    const scriptData = scene.generatedScript;
    const shotContent = scriptData.video_script?.shot_content;

    return shotContent?.bgm || null;
  }

  /**
   * 根据分镜脚本生成提示词
   */
  static generatePromptFromScene(scene: any): string {
    return this.generateImagePromptFromScene(scene);
  }
}
