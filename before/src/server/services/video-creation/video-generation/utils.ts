export const parseJsonIfString = (input: any): any => {
  let value = input;
  for (let i = 0; i < 2 && typeof value === 'string'; i += 1) {
    try {
      value = JSON.parse(value);
    } catch {
      break;
    }
  }
  return value;
};

export const extractShotDurationSeconds = (scriptContent: any): number | undefined => {
  let script = parseJsonIfString(scriptContent);
  if (script?.video_script) {
    script = { ...script, video_script: parseJsonIfString(script.video_script) };
  }
  const videoScript = parseJsonIfString(script?.video_script);
  const shotInfo = parseJsonIfString(
    videoScript?.shot_info ?? videoScript?.shot ?? videoScript?.shot_setting ?? script?.shot_info ?? script?.shot
  );
  const raw = shotInfo?.shot_duration;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const direct = Number(raw);
    if (Number.isFinite(direct)) return direct;
    const match = raw.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const v = Number(match[1]);
      if (Number.isFinite(v)) return v;
    }
  }
  return undefined;
};

