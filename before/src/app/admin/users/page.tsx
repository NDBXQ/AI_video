'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { getMockData } from '@/lib/mock-data';
import { formatDate, getStatusBadge, getStatusColor } from '@/lib/utils';
import { User } from '@/types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>(getMockData.users());
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [viewingUserLogs, setViewingUserLogs] = useState<User | null>(null);

  const operationLogs = getMockData.operationLogs();

  // 筛选用户
  const filteredUsers = users.filter((user) => {
    const matchKeyword =
      user.username.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      user.phone?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchKeyword.toLowerCase());

    const matchStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchKeyword && matchStatus;
  });

  // 切换用户选择
  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  // 禁用/启用用户
  const toggleUserStatus = (userId: string) => {
    setUsers(users.map(user =>
      user.id === userId
        ? { ...user, status: user.status === 'normal' ? 'disabled' : 'normal' }
        : user
    ));
  };

  // 删除用户
  const deleteUser = (userId: string) => {
    if (confirm('确定要删除此用户吗？')) {
      setUsers(users.filter(user => user.id !== userId));
    }
  };

  // 批量操作
  const batchToggleStatus = (targetStatus: 'normal' | 'disabled') => {
    setUsers(users.map(user =>
      selectedUsers.has(user.id)
        ? { ...user, status: targetStatus }
        : user
    ));
    setSelectedUsers(new Set());
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              用户管理
            </h1>
            <p className="mt-1 text-gray-600">管理系统用户与权限</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowAddModal(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
              新增用户
            </Button>
          </div>
        </div>

        {/* 筛选查询区 */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                搜索
              </label>
              <input
                type="text"
                placeholder="账号ID / 用户名 / 手机号 / 邮箱"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 hover:border-gray-300"
              />
            </div>

            <div className="w-full sm:w-48">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                账号状态
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 hover:border-gray-300"
              >
                <option value="all">全部</option>
                <option value="normal">正常</option>
                <option value="disabled">禁用</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" className="rounded-xl hover:bg-gray-100">查询</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setSearchKeyword('');
                  setStatusFilter('all');
                }}
                className="rounded-xl hover:bg-gray-100"
              >
                重置
              </Button>
            </div>
          </div>
        </div>

        {/* 批量操作工具条 */}
        {selectedUsers.size > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-red-50 border border-red-200 p-4 transition-all hover:bg-red-100">
            <div className="flex items-center gap-2 text-sm text-red-900">
              <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>已选择 {selectedUsers.size} 个用户</span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => batchToggleStatus('normal')}
                className="rounded-xl hover:bg-gray-100"
              >
                批量启用
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => batchToggleStatus('disabled')}
                className="rounded-xl"
              >
                批量禁用
              </Button>
            </div>
          </div>
        )}

        {/* 用户列表 */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    <input
                      type="checkbox"
                      checked={selectedUsers.size === filteredUsers.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
                        } else {
                          setSelectedUsers(new Set());
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">账号ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">用户名</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">手机号</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">邮箱</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">角色</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">状态</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">注册时间</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-purple-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{user.id}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.username}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.phone || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.email || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${user.role === 'admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'}`}>
                        {user.role === 'admin' ? '超级管理员' : '普通用户'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={getStatusColor(user.status)}>
                        {getStatusBadge(user.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(user.createdAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" className="rounded-lg hover:bg-gray-100">
                          编辑
                        </Button>
                        <Button
                          size="sm"
                          variant={user.status === 'normal' ? 'danger' : 'secondary'}
                          onClick={() => toggleUserStatus(user.id)}
                          className="rounded-lg"
                        >
                          {user.status === 'normal' ? '禁用' : '启用'}
                        </Button>
                        {user.role !== 'admin' && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => deleteUser(user.id)}
                            className="rounded-lg"
                          >
                            删除
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setViewingUserLogs(user);
                            setShowLogModal(true);
                          }}
                          className="rounded-lg hover:bg-gray-100"
                        >
                          查看日志
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 bg-gradient-to-r from-indigo-50/30 to-purple-50/30">
            <div className="text-sm text-gray-600">
              共 <span className="font-semibold text-gray-900">{filteredUsers.length}</span> 条记录
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled className="rounded-xl hover:bg-gray-100">上一页</Button>
              <Button size="sm" className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">1</Button>
              <Button size="sm" variant="secondary" className="rounded-xl hover:bg-gray-100">下一页</Button>
            </div>
          </div>
        </div>

        {/* 新增用户弹窗 */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
              <h3 className="mb-4 text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">新增用户</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">用户名</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 hover:border-gray-300"
                    placeholder="请输入用户名"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">手机号</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 hover:border-gray-300"
                    placeholder="请输入手机号"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">邮箱</label>
                  <input
                    type="email"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 hover:border-gray-300"
                    placeholder="请输入邮箱"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">角色</label>
                  <select className="w-full rounded-xl border border-gray-200 px-4 py-3 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 hover:border-gray-300">
                    <option value="user">普通用户</option>
                    <option value="admin">超级管理员</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <Button variant="secondary" onClick={() => setShowAddModal(false)} className="flex-1 rounded-xl hover:bg-gray-100">取消</Button>
                <Button onClick={() => setShowAddModal(false)} className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">确定</Button>
              </div>
            </div>
          </div>
        )}

        {/* 操作日志弹窗 */}
        {showLogModal && viewingUserLogs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 max-h-[80vh] overflow-y-auto shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  用户操作日志 - {viewingUserLogs.username}
                </h3>
                <Button size="sm" variant="secondary" onClick={() => setShowLogModal(false)} className="rounded-xl hover:bg-gray-100">关闭</Button>
              </div>
              <div className="space-y-2">
                {operationLogs
                  .filter(log => log.target.includes(viewingUserLogs.username))
                  .map(log => (
                    <div key={log.id} className="rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900">{log.operationType}</div>
                        <div className={`text-sm font-medium ${log.result === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                          {log.result === 'success' ? '成功' : '失败'}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">操作对象: {log.target}</div>
                      <div className="mt-1 text-xs text-gray-500">时间: {formatDate(log.timestamp)}</div>
                    </div>
                  ))}
                {operationLogs.filter(log => log.target.includes(viewingUserLogs.username)).length === 0 && (
                  <div className="text-center text-gray-500 py-8 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>暂无操作日志</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
