import type { ReactNode } from 'react';

/**
 * 信息卡片组件
 */
export function InfoCard({
  icon: Icon,
  title,
  color,
  children,
  className = '',
}: {
  icon: any;
  title: string;
  color: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl p-4 border border-gray-200 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <h4 className="text-xs font-bold text-gray-800">{title}</h4>
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

/**
 * 文本展示组件
 */
export function TextDisplay({
  label,
  content,
  icon: Icon,
  color = 'text-gray-700',
}: {
  label?: string;
  content: string | number | undefined;
  icon?: any;
  color?: string;
}) {
  if (content === undefined || content === null || content === '') return null;

  // 如果 content 不是字符串或数字，转换为安全的字符串表示
  let displayContent: string;
  if (typeof content === 'string' || typeof content === 'number') {
    displayContent = String(content);
  } else {
    // 对于对象或其他类型，使用 JSON.stringify 或返回默认值
    displayContent = typeof content === 'object' ? JSON.stringify(content) : String(content);
  }

  if (!label) {
    return (
      <div className={`text-xs leading-relaxed ${color} bg-gray-50 rounded-md px-3 py-2 border border-gray-200 whitespace-pre-wrap`}>
        {displayContent}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] gap-1 sm:gap-3 items-start">
      <div className="text-[11px] font-medium text-gray-500 flex items-center gap-1 sm:pt-2">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className={`text-xs leading-relaxed ${color} bg-gray-50 rounded-md px-3 py-2 border border-gray-200 whitespace-pre-wrap`}>
        {displayContent}
      </div>
    </div>
  );
}

/**
 * 标签展示组件
 */
export function TagDisplay({
  label,
  tags,
  color = 'bg-gray-100 text-gray-700 border border-gray-200',
  icon: Icon,
}: {
  label?: string;
  tags: (string | Record<string, any>)[] | undefined;
  color?: string;
  icon?: any;
}) {
  if (!tags || tags.length === 0) return null;

  // 转换为字符串数组
  const stringTags = tags.map((tag) => {
    if (typeof tag === 'string') {
      return tag;
    } else if (typeof tag === 'object' && tag !== null) {
      // 如果是对象，提取 item_name 或 description
      return (tag as any).item_name || (tag as any).description || JSON.stringify(tag);
    }
    return String(tag);
  });

  return (
    <div>
      {label && (
        <div className="text-[11px] font-medium text-gray-500 mb-2 flex items-center gap-1">
          {Icon && <Icon className="w-3 h-3" />}
          {label}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {stringTags.map((tag, index) => (
          <span
            key={index}
            className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium ${color}`}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
