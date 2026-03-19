export interface CanvasSizePreset {
  id: string;
  platform: 'xiaohongshu' | 'instagram' | 'wechat' | 'general' | 'print';
  sceneLabel: string;
  width: number;
  height: number;
}

export const CANVAS_SIZE_PRESETS: CanvasSizePreset[] = [
  {
    id: 'xiaohongshu-cover',
    platform: 'xiaohongshu',
    sceneLabel: '小红书封面',
    width: 1242,
    height: 1660,
  },
  {
    id: 'xiaohongshu-square',
    platform: 'xiaohongshu',
    sceneLabel: '小红书方图',
    width: 1080,
    height: 1080,
  },
  {
    id: 'instagram-portrait',
    platform: 'instagram',
    sceneLabel: 'Instagram 竖版帖子',
    width: 1080,
    height: 1350,
  },
  {
    id: 'instagram-story',
    platform: 'instagram',
    sceneLabel: 'Story / Reels 封面',
    width: 1080,
    height: 1920,
  },
  {
    id: 'wechat-moments-long',
    platform: 'wechat',
    sceneLabel: '朋友圈长图',
    width: 1080,
    height: 1440,
  },
  {
    id: 'print-card',
    platform: 'print',
    sceneLabel: '打印卡片（A4）',
    width: 1240,
    height: 1754,
  },
  {
    id: 'classic-4x3',
    platform: 'general',
    sceneLabel: '通用横版 4:3',
    width: 1440,
    height: 1080,
  },
  {
    id: 'classic-16x9',
    platform: 'general',
    sceneLabel: '通用横版 16:9',
    width: 1920,
    height: 1080,
  },
];

export const DEFAULT_CANVAS_PRESET_ID = 'instagram-portrait';
export const MULTI_EXPORT_PRESET_IDS = [
  'xiaohongshu-cover',
  'xiaohongshu-square',
  'instagram-story',
  'wechat-moments-long',
  'print-card',
] as const;

export function getCanvasSizePresetById(id: string) {
  return CANVAS_SIZE_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function getCanvasSizePresetSummary(id: string) {
  const preset = getCanvasSizePresetById(id);

  if (!preset) {
    return null;
  }

  return `${preset.sceneLabel} · ${preset.width}×${preset.height}`;
}

export function getMultiExportPresets() {
  return MULTI_EXPORT_PRESET_IDS
    .map((id) => getCanvasSizePresetById(id))
    .filter((preset): preset is CanvasSizePreset => preset !== null);
}
