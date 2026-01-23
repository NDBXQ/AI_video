/**
 * ScriptResultModal - 分镜脚本生成结果展示Modal
 * 基于实际API数据结构：shot、shot_content、video_content三个区域
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Film, X, Copy, LayoutList } from 'lucide-react';
import { ShotInfo } from './script-result-modal/ShotInfo';
import { ShotContent } from './script-result-modal/ShotContent';
import { VideoContent } from './script-result-modal/VideoContent';
import { parseScriptData } from './script-result-modal/types';

interface ScriptResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneTitle: string;
  scriptData: any;
}

export function ScriptResultModal({
  isOpen,
  onClose,
  sceneTitle,
  scriptData,
}: ScriptResultModalProps) {
  const parsedData = useMemo(() => (isOpen ? parseScriptData(scriptData) : null), [isOpen, scriptData]);
  const [activeSection, setActiveSection] = useState<'shot' | 'shotContent' | 'videoContent'>('shot');
  const contentRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const sections = useMemo(
    () => [
      { id: 'shot', title: '镜头设置' },
      { id: 'shotContent', title: '拍摄内容' },
      { id: 'videoContent', title: '视频内容' },
    ],
    []
  );

  const sectionStatus = useMemo(() => {
    if (!parsedData) {
      return {
        shot: false,
        shotContent: false,
        videoContent: false,
      };
    }
    const shot = parsedData.shot as any;
    const shotHas =
      shot &&
      (shot.shot_duration !== undefined ||
        shot.shot_style !== undefined ||
        shot.cut_to !== undefined);

    const shotContent = parsedData.shot_content as any;
    const shotContentHas =
      shotContent &&
      (shotContent.background ||
        (Array.isArray(shotContent.roles) && shotContent.roles.length > 0) ||
        (Array.isArray(shotContent.role_items) && shotContent.role_items.length > 0) ||
        (Array.isArray(shotContent.other_items) && shotContent.other_items.length > 0) ||
        shotContent.shoot ||
        shotContent.bgm);

    const videoContent = parsedData.video_content as any;
    const videoContentHas =
      videoContent &&
      (videoContent.background ||
        (Array.isArray(videoContent.roles) && videoContent.roles.length > 0) ||
        (Array.isArray(videoContent.items) && videoContent.items.length > 0) ||
        (Array.isArray(videoContent.other_items) && videoContent.other_items.length > 0));

    return {
      shot: !!shotHas,
      shotContent: !!shotContentHas,
      videoContent: !!videoContentHas,
    };
  }, [parsedData]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    if (!parsedData) return;
    const el = contentRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((x) => x.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top ?? 0) - (b.boundingClientRect.top ?? 0))[0];
        if (visible?.target?.id === 'shot') setActiveSection('shot');
        if (visible?.target?.id === 'shotContent') setActiveSection('shotContent');
        if (visible?.target?.id === 'videoContent') setActiveSection('videoContent');
      },
      { root: el, threshold: 0.35 }
    );

    sections.forEach((s) => {
      const target = sectionRefs.current[s.id];
      if (target) observer.observe(target);
    });

    return () => observer.disconnect();
  }, [isOpen, parsedData, sections]);

  const scrollTo = (id: string) => {
    const target = sectionRefs.current[id];
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(scriptData ?? parsedData, null, 2));
    } catch {}
  };

  if (!isOpen) return null;
  if (!parsedData) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col relative border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">分镜脚本</h3>
              <p className="text-xs text-violet-600">{sceneTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold"
            >
              <Copy className="w-4 h-4" />
              复制
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-rows-[auto_1fr]">
          <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
              <LayoutList className="w-4 h-4" />
              目录
            </div>
            <div className="text-xs text-gray-500">Esc 关闭</div>
          </div>

          <div className="min-h-0 grid grid-cols-1 lg:grid-cols-[240px_1fr]">
            <div className="border-b lg:border-b-0 lg:border-r border-gray-100 bg-white">
              <div className="p-3 lg:p-4 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible">
                {sections.map((s) => {
                  const active = activeSection === (s.id as any);
                  const hasData = (sectionStatus as any)[s.id] ?? false;
                  return (
                    <button
                      key={s.id}
                      onClick={() => scrollTo(s.id)}
                      className={`flex-shrink-0 lg:w-full text-left px-3 py-2 rounded-md text-xs font-semibold transition-colors border ${
                        active ? 'bg-gray-50 border-gray-200 text-gray-900' : 'bg-white border-transparent text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-4 w-0.5 rounded ${active ? 'bg-violet-600' : 'bg-transparent'}`} />
                          <span>{s.title}</span>
                        </div>
                        <span className={`text-[11px] ${hasData ? 'text-gray-400' : 'text-gray-300'}`}>
                          {hasData ? '•' : '—'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div ref={contentRef} className="min-h-0 overflow-y-auto px-5 sm:px-6 py-4 bg-white">
              <div className="space-y-4">
                <section
                  id="shot"
                  ref={(el) => {
                    sectionRefs.current.shot = el;
                  }}
                >
                  <ShotInfo shot={parsedData.shot} />
                </section>
                <section
                  id="shotContent"
                  ref={(el) => {
                    sectionRefs.current.shotContent = el;
                  }}
                >
                  <ShotContent shotContent={parsedData.shot_content} />
                </section>
                <section
                  id="videoContent"
                  ref={(el) => {
                    sectionRefs.current.videoContent = el;
                  }}
                >
                  <VideoContent videoContent={parsedData.video_content} />
                </section>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-semibold text-sm border border-gray-200"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
