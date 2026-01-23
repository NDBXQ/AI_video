import type { PublicResource } from '@/types';

export type LibraryScope = 'works' | 'public';

export type WorksSection = 'drafts' | 'videos' | 'scripts';
export type PublicSection = 'all' | PublicResource['type'];

export type ViewMode = 'grid' | 'list';
export type SortKey = 'recent' | 'oldest' | 'title';

export interface Story {
  id: string;
  title: string;
  userId: string;
  progressStage: 'outline' | 'text' | 'script' | 'completed';
  aspectRatio?: string;
  resolution?: string;
  resolutionPreset?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryStoryboardScript {
  id: string;
  storyboardTextId: string;
  sequence: number;
  sceneTitle: string | null;
  scriptContent: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export type WorksItem =
  | { kind: 'draft'; story: Story }
  | { kind: 'video'; story: Story }
  | { kind: 'script'; script: LibraryStoryboardScript };

export type DetailsItem =
  | { kind: 'script'; script: LibraryStoryboardScript }
  | { kind: 'public'; resource: PublicResource };
