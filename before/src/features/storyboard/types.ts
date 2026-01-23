export interface OutlineItem {
  outline: string;
  original: string;
  outlineId?: string;
  sequence?: number;
}

export interface GeneratedOutline {
  story_original: string;
  story_text: string;
  outline_original_list: OutlineItem[];
  run_id: string;
}
