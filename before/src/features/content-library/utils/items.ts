import type { DetailsItem, SortKey, WorksItem } from '../domain/types';
import { progressStageLabels } from '../domain/constants';

export function getWorksItemId(item: WorksItem): string {
  switch (item.kind) {
    case 'draft':
    case 'video':
      return item.story.id;
    case 'script':
      return item.script.id;
  }
}

export function getWorksItemPrimaryText(item: WorksItem): string {
  switch (item.kind) {
    case 'draft':
    case 'video':
      return item.story.title;
    case 'script':
      return item.script.sceneTitle || `分镜脚本 #${item.script.sequence}`;
  }
}

export function getWorksItemSearchText(item: WorksItem): string {
  switch (item.kind) {
    case 'draft':
    case 'video':
      return `${item.story.title} ${progressStageLabels[item.story.progressStage] || item.story.progressStage}`;
    case 'script':
      return `${item.script.sceneTitle || ''} ${item.script.scriptContent}`;
  }
}

export function getWorksItemDateValue(item: WorksItem): number {
  switch (item.kind) {
    case 'draft':
    case 'video':
      return new Date(item.story.updatedAt || item.story.createdAt).getTime();
    case 'script':
      return new Date(item.script.updatedAt || item.script.createdAt).getTime();
  }
}

export function sortWorksItems(items: WorksItem[], sortKey: SortKey): WorksItem[] {
  const copy = [...items];

  if (sortKey === 'title') {
    return copy.sort((a, b) => getWorksItemPrimaryText(a).localeCompare(getWorksItemPrimaryText(b), 'zh-CN'));
  }

  if (sortKey === 'oldest') {
    return copy.sort((a, b) => getWorksItemDateValue(a) - getWorksItemDateValue(b));
  }

  return copy.sort((a, b) => getWorksItemDateValue(b) - getWorksItemDateValue(a));
}

export function getEditUrl(progressStage: string, id: string) {
  switch (progressStage) {
    case 'outline':
      return `/storyboard/create/outline?storyId=${id}`;
    case 'text':
      return `/storyboard/text?storyId=${id}`;
    case 'script':
      return `/video-creation?storyId=${id}`;
    case 'completed':
      return `/video-creation?storyId=${id}`;
    default:
      return `/storyboard/create/outline?storyId=${id}`;
  }
}

export function getDetailsTitle(details: DetailsItem): string {
  switch (details.kind) {
    case 'script':
      return '分镜脚本';
    case 'public':
      return '公共资源';
  }
}
