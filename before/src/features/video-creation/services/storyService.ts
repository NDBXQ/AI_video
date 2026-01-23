/**
 * 故事服务 - 处理故事相关的API调用
 */

import { Story, ApiResponse, Scene, TimelineVideoData } from '../domain/types';

const BASE_URL = '/api/video-creation';

export class StoryService {
  /**
   * 获取故事列表
   */
  static async fetchStories(storyId?: string | null): Promise<Story[]> {
    try {
      console.log('[StoryService] 开始获取故事列表... storyId:', storyId);
      const url = storyId ? `${BASE_URL}/scripts?storyId=${storyId}` : `${BASE_URL}/scripts`;
      const response = await fetch(url);
      console.log('[StoryService] API响应状态:', response.status);
      const data: ApiResponse<Story[]> = await response.json();
      console.log('[StoryService] API返回数据:', data);

      if (data.success && data.data) {
        console.log('[StoryService] 成功获取', data.data.length, '个故事');
        return data.data;
      }

      console.error('获取故事列表失败:', data.message);
      return [];
    } catch (error) {
      console.error('获取故事列表失败:', error);
      return [];
    }
  }

  /**
   * 获取故事详情
   */
  static async fetchStoryDetail(storyId: string): Promise<{
    story: Story;
    scenes: Scene[];
  } | null> {
    try {
      const response = await fetch(`${BASE_URL}/scripts/${storyId}`);
      const data: ApiResponse<any> = await response.json();

      if (data.success && data.data) {
        return {
          story: data.data,
          scenes: data.data.scenes || [],
        };
      }

      console.error('获取故事详情失败:', data.message);
      return null;
    } catch (error) {
      console.error('获取故事详情失败:', error);
      return null;
    }
  }

  /**
   * 获取大纲对应的分镜文本
   */
  static async fetchOutlineScenes(outlineId: string): Promise<Scene[]> {
    try {
      console.log('[StoryService] 开始获取大纲分镜, outlineId:', outlineId);
      const response = await fetch(`${BASE_URL}/scripts/outline/${outlineId}`);
      const data: ApiResponse<Scene[]> = await response.json();
      console.log('[StoryService] 大纲分镜返回数据:', data);

      if (data.success && data.data) {
        console.log('[StoryService] 成功获取', data.data.length, '个分镜');
        return data.data;
      }

      console.error('获取大纲分镜失败:', data.message);
      return [];
    } catch (error) {
      console.error('获取大纲分镜失败:', error);
      return [];
    }
  }

  /**
   * 获取时间线数据
   */
  static async fetchTimeline(outlineId: string): Promise<TimelineVideoData[]> {
    try {
      console.log('[StoryService] 开始获取时间线数据, outlineId:', outlineId);
      const timestamp = Date.now();
      const response = await fetch(`${BASE_URL}/timeline?outlineId=${outlineId}&t=${timestamp}`);
      const data: ApiResponse<{ scenes: TimelineVideoData[] }> = await response.json();
      
      if (data.success && data.data?.scenes) {
        console.log('[StoryService] 成功获取时间线数据');
        return data.data.scenes;
      }
      
      console.error('获取时间线数据失败:', data.message);
      return [];
    } catch (error) {
      console.error('获取时间线数据失败:', error);
      return [];
    }
  }
}
