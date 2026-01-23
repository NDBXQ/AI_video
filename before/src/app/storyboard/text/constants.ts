/**
 * 分镜文本页面的常量定义
 */

export const USAGE_STEPS = [
  {
    step: 1,
    title: '输入故事内容',
    desc: '支持故事原文或剧情简介，字数建议在 100-2000 字之间',
  },
  {
    step: 2,
    title: 'AI生成分镜文本',
    desc: '系统会自动分析内容，生成结构化的场景描述',
  },
  {
    step: 3,
    title: '预览并编辑',
    desc: '查看生成的分镜文本，支持手动调整',
  },
  {
    step: 4,
    title: '进入下一步',
    desc: '确认后进入分镜脚本生成，完善镜头、时长等细节',
  },
];

export const PROFESSIONAL_TIP = {
  title: '专业提示',
  content:
    '生成的分镜文本可以直接作为分镜脚本的基础。在下一步中，系统会根据分镜文本自动生成镜头类型、时长、机位等详细信息。',
};

export const GENERATING_TIME_PER_SCENE = 15; // 每个场景预计生成时间（秒）
export const URL_DATA_SIZE_WARNING_THRESHOLD = 50000; // URL参数大小警告阈值（字符）

export const ERROR_MESSAGES = {
  TIMEOUT: '生成时间较长，请稍后重试或减少输入内容长度',
  SERVER_ERROR: '服务器错误，请稍后重试',
  NETWORK_ERROR: '网络连接失败，请检查网络或稍后重试',
  GENERATING: '生成失败，请点击"重新生成"按钮重试',
  DATA_TOO_LARGE: '数据量过大，可能导致页面加载缓慢。建议使用草稿保存功能。',
  NAVIGATION_FAILED: '跳转失败，请稍后重试',
  GENERATING_IN_PROGRESS: '正在生成分镜文本，请稍候...',
};

export const STEP_LABELS = {
  input: '场景文本',
  preview: '场景文本',
};
