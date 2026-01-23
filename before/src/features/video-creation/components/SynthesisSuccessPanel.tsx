/**
 * SynthesisSuccessPanel - 合成成功面板
 */

import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface SynthesisSuccessPanelProps {
  onDownload: () => void;
}

export function SynthesisSuccessPanel({ onDownload }: SynthesisSuccessPanelProps) {
  return (
    <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-green-800">合成成功！</h4>
          <p className="mt-1 text-sm text-green-700">视频已保存到内容库</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button size="sm" className="flex-1" onClick={onDownload}>
          下载视频
        </Button>
        <Link href="/content-library" className="flex-1">
          <Button size="sm" variant="secondary" className="w-full">
            查看内容库
          </Button>
        </Link>
      </div>
    </div>
  );
}
