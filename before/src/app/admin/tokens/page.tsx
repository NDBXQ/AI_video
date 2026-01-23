'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { getMockData } from '@/lib/mock-data';
import { formatDate, getStatusBadge, getStatusColor, maskToken } from '@/lib/utils';
import { ApiToken } from '@/types';

export default function AdminTokensPage() {
  const [tokens, setTokens] = useState<ApiToken[]>(getMockData.apiTokens());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState('');
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedToken, setSelectedToken] = useState<ApiToken | null>(null);

  const tokenUsageLogs = getMockData.tokenUsageLogs();

  // 筛选 Token
  const filteredTokens = tokens.filter((token) => {
    const matchStatus = statusFilter === 'all' || token.status === statusFilter;
    const matchUser = !userFilter ||
      token.username.toLowerCase().includes(userFilter.toLowerCase()) ||
      token.userId.toLowerCase().includes(userFilter.toLowerCase());
    return matchStatus && matchUser;
  });

  // 切换 Token 选择
  const toggleTokenSelection = (tokenId: string) => {
    const newSelection = new Set(selectedTokens);
    if (newSelection.has(tokenId)) {
      newSelection.delete(tokenId);
    } else {
      newSelection.add(tokenId);
    }
    setSelectedTokens(newSelection);
  };

  // 失效 Token
  const revokeToken = (tokenId: string) => {
    if (confirm('确定要失效此 Token 吗？')) {
      setTokens(tokens.map(t =>
        t.id === tokenId ? { ...t, status: 'revoked' } : t
      ));
    }
  };

  // 刷新 Token
  const refreshToken = (tokenId: string, mode: 'extend' | 'reset') => {
    if (mode === 'reset' && !confirm('重置 Token 后原 Token 将失效，确定要继续吗？')) {
      return;
    }

    setTokens(tokens.map(t => {
      if (t.id === tokenId) {
        if (mode === 'reset') {
          return {
            ...t,
            token: `sk_live_${Math.random().toString(36).substring(2, 15)}`,
            status: 'active',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          };
        } else {
          return {
            ...t,
            status: 'active',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          };
        }
      }
      return t;
    }));
  };

  // 批量失效
  const batchRevoke = () => {
    if (confirm(`确定要失效选中的 ${selectedTokens.size} 个 Token 吗？`)) {
      setTokens(tokens.map(t =>
        selectedTokens.has(t.id) ? { ...t, status: 'revoked' } : t
      ));
      setSelectedTokens(new Set());
    }
  };

  // 生成新 Token
  const generateToken = (userId: string, days: number) => {
    const user = getMockData.userById(userId);
    if (!user) return;

    const newToken: ApiToken = {
      id: `t${Date.now()}`,
      token: `sk_live_${Math.random().toString(36).substring(2, 15)}`,
      userId,
      username: user.username,
      permissions: ['content:read', 'content:create'],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
    };

    setTokens([newToken, ...tokens]);
    setShowGenerateModal(false);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              API Token 管理
            </h1>
            <p className="mt-1 text-gray-600">管理 API Token 全生命周期</p>
          </div>
          <Button onClick={() => setShowGenerateModal(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
            生成 Token
          </Button>
        </div>

        {/* 筛选查询区 */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                关联用户
              </label>
              <input
                type="text"
                placeholder="用户名 / 用户ID"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 hover:border-gray-300"
              />
            </div>

            <div className="w-full sm:w-48">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Token 状态
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 hover:border-gray-300"
              >
                <option value="all">全部</option>
                <option value="active">有效</option>
                <option value="expired">已过期</option>
                <option value="revoked">已失效</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" className="rounded-xl hover:bg-gray-100">查询</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setUserFilter('');
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
        {selectedTokens.size > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-red-50 border border-red-200 p-4 transition-all hover:bg-red-100">
            <div className="flex items-center gap-2 text-sm text-red-900">
              <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>已选择 {selectedTokens.size} 个 Token</span>
            </div>
            <Button size="sm" variant="danger" onClick={batchRevoke} className="rounded-xl">
              批量失效
            </Button>
          </div>
        )}

        {/* Token 列表 */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    <input
                      type="checkbox"
                      checked={selectedTokens.size === filteredTokens.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTokens(new Set(filteredTokens.map(t => t.id)));
                        } else {
                          setSelectedTokens(new Set());
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Token</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">关联用户</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">权限范围</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">生成时间</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">有效期</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">状态</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTokens.map((token) => (
                  <tr key={token.id} className="hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-purple-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedTokens.has(token.id)}
                        onChange={() => toggleTokenSelection(token.id)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <code className="rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 px-3 py-1.5 text-sm font-mono text-gray-700">
                        {maskToken(token.token)}
                      </code>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{token.username}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {token.permissions.map((perm, idx) => (
                          <span
                            key={idx}
                            className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                          >
                            {perm}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(token.createdAt)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(token.expiresAt)}</td>
                    <td className="px-6 py-4">
                      <span className={getStatusColor(token.status)}>
                        {getStatusBadge(token.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedToken(token);
                            setShowDetailModal(true);
                          }}
                          className="rounded-lg hover:bg-gray-100"
                        >
                          详情
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedToken(token);
                            setShowRefreshModal(true);
                          }}
                          className="rounded-lg hover:bg-gray-100"
                        >
                          刷新
                        </Button>
                        {token.status === 'active' && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => revokeToken(token.id)}
                            className="rounded-lg"
                          >
                            失效
                          </Button>
                        )}
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
              共 <span className="font-semibold text-gray-900">{filteredTokens.length}</span> 条记录
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled className="rounded-xl hover:bg-gray-100">上一页</Button>
              <Button size="sm" className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">1</Button>
              <Button size="sm" variant="secondary" className="rounded-xl hover:bg-gray-100">下一页</Button>
            </div>
          </div>
        </div>

        {/* 生成 Token 弹窗 */}
        {showGenerateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
              <h3 className="mb-4 text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">生成 API Token</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">关联用户</label>
                  <select className="w-full rounded-xl border border-gray-200 px-4 py-3 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 hover:border-gray-300">
                    <option value="u002">user1 (普通用户)</option>
                    <option value="u004">creator01 (普通用户)</option>
                    <option value="u005">testuser (普通用户)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">有效期（天）</label>
                  <input
                    type="number"
                    defaultValue={30}
                    min={1}
                    max={365}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 hover:border-gray-300"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">权限模板</label>
                  <select className="w-full rounded-xl border border-gray-200 px-4 py-3 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 hover:border-gray-300">
                    <option value="full">全接口访问</option>
                    <option value="read">仅内容查询接口访问</option>
                    <option value="generate">仅素材生成接口访问</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <Button variant="secondary" onClick={() => setShowGenerateModal(false)} className="flex-1 rounded-xl hover:bg-gray-100">取消</Button>
                <Button onClick={() => generateToken('u002', 30)} className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">生成</Button>
              </div>
            </div>
          </div>
        )}

        {/* 刷新 Token 弹窗 */}
        {showRefreshModal && selectedToken && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
              <h3 className="mb-4 text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">刷新 Token</h3>
              <div className="mb-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 p-4">
                <div className="text-sm text-gray-600">当前 Token</div>
                <code className="mt-1 block rounded-lg bg-white px-3 py-2 font-mono text-sm border border-gray-200">{maskToken(selectedToken.token)}</code>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    refreshToken(selectedToken.id, 'extend');
                    setShowRefreshModal(false);
                  }}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-900 transition-all hover:border-indigo-300 hover:bg-indigo-50/50"
                >
                  <div>仅刷新有效期</div>
                  <div className="text-xs text-gray-500 mt-1">Token 值不变，延长有效期限</div>
                </button>
                <button
                  onClick={() => {
                    refreshToken(selectedToken.id, 'reset');
                    setShowRefreshModal(false);
                  }}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-900 transition-all hover:border-indigo-300 hover:bg-indigo-50/50"
                >
                  <div>重置 Token 值</div>
                  <div className="text-xs text-gray-500 mt-1">生成新 Token，原 Token 即时失效</div>
                </button>
              </div>
              <div className="mt-4">
                <Button variant="secondary" onClick={() => setShowRefreshModal(false)} className="w-full rounded-xl hover:bg-gray-100">取消</Button>
              </div>
            </div>
          </div>
        )}

        {/* Token 详情弹窗 */}
        {showDetailModal && selectedToken && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 max-h-[80vh] overflow-y-auto shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Token 详情</h3>
                <Button size="sm" variant="secondary" onClick={() => setShowDetailModal(false)} className="rounded-xl hover:bg-gray-100">关闭</Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 p-4">
                    <div className="text-sm text-gray-600">Token ID</div>
                    <div className="mt-1 font-mono text-sm text-gray-900 font-medium">{selectedToken.id}</div>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 p-4">
                    <div className="text-sm text-gray-600">Token 值</div>
                    <code className="mt-1 block font-mono text-sm text-gray-900 font-medium">{maskToken(selectedToken.token)}</code>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 p-4">
                    <div className="text-sm text-gray-600">关联用户</div>
                    <div className="mt-1 text-sm text-gray-900 font-medium">{selectedToken.username}</div>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 p-4">
                    <div className="text-sm text-gray-600">用户ID</div>
                    <div className="mt-1 text-sm text-gray-900 font-medium">{selectedToken.userId}</div>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 p-4">
                    <div className="text-sm text-gray-600">状态</div>
                    <div className={`mt-1 text-sm font-medium ${getStatusColor(selectedToken.status)}`}>
                      {getStatusBadge(selectedToken.status)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 p-4">
                    <div className="text-sm text-gray-600">最后使用</div>
                    <div className="mt-1 text-sm text-gray-900 font-medium">
                      {selectedToken.lastUsedAt ? formatDate(selectedToken.lastUsedAt) : '未使用'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 p-4">
                    <div className="text-sm text-gray-600">生成时间</div>
                    <div className="mt-1 text-sm text-gray-900 font-medium">{formatDate(selectedToken.createdAt)}</div>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 p-4">
                    <div className="text-sm text-gray-600">有效期至</div>
                    <div className="mt-1 text-sm text-gray-900 font-medium">{formatDate(selectedToken.expiresAt)}</div>
                  </div>
                </div>

                <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 p-4">
                  <div className="mb-2 text-sm font-medium text-gray-700">权限范围</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedToken.permissions.map((perm, idx) => (
                      <span key={idx} className="rounded-full bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-800">
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700">使用日志</div>
                  <div className="space-y-2">
                    {tokenUsageLogs
                      .filter(log => log.tokenId === selectedToken.id)
                      .map(log => (
                        <div key={log.id} className="rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-gray-900">{log.apiEndpoint}</div>
                            <div className={`text-sm font-medium ${log.result === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                              {log.result === 'success' ? '成功' : log.result === 'failed' ? '失败' : '错误'}
                            </div>
                          </div>
                          <div className="mt-2 text-sm text-gray-600">IP: {log.ip}</div>
                          <div className="mt-1 text-xs text-gray-500">时间: {formatDate(log.timestamp)}</div>
                        </div>
                      ))}
                    {tokenUsageLogs.filter(log => log.tokenId === selectedToken.id).length === 0 && (
                      <div className="text-center text-gray-500 py-8 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100">
                        <svg className="mx-auto h-12 w-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p>暂无使用日志</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
