export interface StoryboardText {
  id: string;
  title: string;
  type: 'original' | 'brief';
  content: string;
  generatedText: string;
  createdAt: string;
}

export interface OutlineData {
  story_text?: string;
  outline_original_list: OutlineItem[];
  storyId?: string;
  userId?: string;
  run_id?: string;
}

export interface SceneStoryboardText {
  id: string;
  sequence: number;
  shotCut: boolean;
  storyboardText: string;
  createdAt?: string;
  updatedAt?: string | null;
}

export interface OutlineItem {
  outline: string;
  original: string;
  outlineId?: string;
  sequence?: number;
  storyboardText?: string;
  storyboardTexts?: SceneStoryboardText[];
  shotCut?: boolean;
  storyboardTextId?: string;
  generationStatus?: 'pending' | 'generating' | 'completed' | 'failed';
}

export interface GeneratingProgress {
  completed: number;
  total: number;
  currentScene: string;
}

export type SceneGenerationStatus = 'pending' | 'generating' | 'completed' | 'failed';
