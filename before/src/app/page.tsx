'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { HomeLanding, HomeDashboard } from '@/features/home/ui';

export default function HomePage() {
  // 从 localStorage 加载登录状态
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // 客户端挂载后初始化登录状态，避免 Hydration 错误
  useEffect(() => {
    setIsMounted(true);
    const savedLoginStatus = localStorage.getItem('isLoggedIn') === 'true';
    setIsLoggedIn(savedLoginStatus);
  }, []);

  // 当登录状态改变时，保存到 localStorage
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('isLoggedIn', isLoggedIn.toString());
    }
  }, [isLoggedIn, isMounted]);

  // 等待客户端挂载后再决定渲染内容
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center text-gray-600">加载中...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <HomeLanding onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <MainLayout>
      <HomeDashboard />
    </MainLayout>
  );
}
