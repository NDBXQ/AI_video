import type { PublicSection, SortKey, WorksSection } from './types';

export const worksSectionLabels: Record<WorksSection, string> = {
  drafts: '草稿',
  videos: '成片',
  scripts: '分镜脚本',
};

export const publicSectionLabels: Record<PublicSection, string> = {
  all: '全部',
  character: '角色库',
  background: '背景库',
  props: '道具库',
  music: '音乐库',
  effect: '特效库',
  transition: '转场库',
};

export const sortLabels: Record<SortKey, string> = {
  recent: '最近更新',
  oldest: '最早创建',
  title: '标题排序',
};

export const progressStageLabels: Record<string, string> = {
  outline: '故事大纲',
  text: '分镜文本',
  script: '分镜脚本',
  completed: '已完成',
};
