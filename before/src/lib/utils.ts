import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleString('zh-CN');
}

export function maskToken(token: string): string {
  if (token.length <= 10) return token;
  return token.slice(0, 8) + '...' + token.slice(-4);
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    normal: 'text-green-600',
    disabled: 'text-gray-500',
    completed: 'text-green-600',
    draft: 'text-yellow-600',
    processing: 'text-blue-600',
    failed: 'text-red-600',
    active: 'text-green-600',
    expired: 'text-gray-500',
    revoked: 'text-red-600',
    generating: 'text-blue-600',
  };
  return colors[status] || 'text-gray-600';
}

export function getStatusBadge(status: string): string {
  const badges: Record<string, string> = {
    normal: '正常',
    disabled: '禁用',
    completed: '已完成',
    draft: '草稿',
    processing: '处理中',
    failed: '失败',
    active: '有效',
    expired: '已过期',
    revoked: '已失效',
    generating: '生成中',
  };
  return badges[status] || status;
}
