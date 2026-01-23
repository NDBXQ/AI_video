/**
 * MaterialLibrary - 图片素材库组件
 * 用于展示和管理视频创作所需的图片素材
 */

import { Image, Search, Filter, Grid, List, Heart, Download, Plus } from 'lucide-react';

// 模拟素材数据
const mockMaterials = [
  {
    id: 1,
    title: '城市日出',
    url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&h=300&fit=crop',
    category: '风景',
    size: '1920x1080',
    liked: false,
  },
  {
    id: 2,
    title: '科技感办公',
    url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=400&h=300&fit=crop',
    category: '商务',
    size: '1920x1080',
    liked: true,
  },
  {
    id: 3,
    title: '抽象几何',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=400&h=300&fit=crop',
    category: '设计',
    size: '1920x1080',
    liked: false,
  },
  {
    id: 4,
    title: '自然风光',
    url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=300&fit=crop',
    category: '风景',
    size: '1920x1080',
    liked: false,
  },
  {
    id: 5,
    title: '人物肖像',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop',
    category: '人物',
    size: '1920x1080',
    liked: true,
  },
  {
    id: 6,
    title: '现代建筑',
    url: 'https://images.unsplash.com/photo-1486718448742-163732cd1544?w=400&h=300&fit=crop',
    category: '建筑',
    size: '1920x1080',
    liked: false,
  },
  {
    id: 7,
    title: '美食特写',
    url: 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=400&h=300&fit=crop',
    category: '美食',
    size: '1920x1080',
    liked: false,
  },
  {
    id: 8,
    title: '运动瞬间',
    url: 'https://images.unsplash.com/photo-1461896836934- voices?w=400&h=300&fit=crop',
    category: '运动',
    size: '1920x1080',
    liked: false,
  },
];

// 素材卡片组件
function MaterialCard({ material, index }: { material: typeof mockMaterials[0]; index: number }) {
  return (
    <div className="group relative rounded-xl overflow-hidden border-2 border-gray-200/60 bg-white shadow-sm hover:shadow-xl hover:border-violet-300 transition-all duration-300 hover:-translate-y-1 cursor-pointer">
      {/* 图片 */}
      <div className="aspect-video relative overflow-hidden">
        <img
          src={material.url}
          alt={material.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        {/* 悬浮遮罩 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* 悬浮操作栏 */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <button
          className={`p-1.5 rounded-lg backdrop-blur-md transition-colors ${
            material.liked
              ? 'bg-red-500/90 text-white hover:bg-red-600'
              : 'bg-white/90 text-gray-600 hover:bg-white hover:text-red-500'
          }`}
        >
          <Heart className={`w-4 h-4 ${material.liked ? 'fill-current' : ''}`} />
        </button>
        <button className="p-1.5 rounded-lg bg-white/90 text-gray-600 backdrop-blur-md hover:bg-white hover:text-violet-600 transition-colors">
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* 底部信息 */}
      <div className="p-2.5">
        <h4 className="text-sm font-semibold text-gray-800 truncate">{material.title}</h4>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-medium">
            {material.category}
          </span>
          <span className="text-[10px] text-gray-500 font-mono">{material.size}</span>
        </div>
      </div>
    </div>
  );
}

interface MaterialLibraryProps {
  className?: string;
}

export function MaterialLibrary({ className = '' }: MaterialLibraryProps) {
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* 素材网格 */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          {mockMaterials.map((material, index) => (
            <MaterialCard key={material.id} material={material} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
