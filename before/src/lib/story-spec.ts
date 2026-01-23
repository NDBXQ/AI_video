export type AspectRatio = '16:9' | '4:3' | '3:4' | '9:16';
export type ResolutionPreset = '480p' | '720p' | '1080p';

export function calcResolution(aspectRatio: AspectRatio, preset: ResolutionPreset) {
  const height = preset === '480p' ? 480 : preset === '720p' ? 720 : 1080;
  const [w, h] = aspectRatio.split(':').map((n) => Number(n));
  let width = Math.round((height * w) / h);
  if (width % 2 !== 0) width += 1;
  return { width, height, text: `${width}x${height}` };
}
