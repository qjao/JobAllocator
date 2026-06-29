import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../types';
import { Train, LogOut, Home, Shield, Check, X, Edit2, Trash2, Key, Loader2, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Moon, Sun, Calendar as CalendarIcon, User as UserIcon, HelpCircle } from 'lucide-react';
import HelpModal from './HelpModal';

interface AdminUsersPageProps {
  user: User;
  onLogout: () => void;
  onNavigate: (view: 'dashboard' | 'admin' | 'profile' | 'calendar') => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

import Header from './Header';

export default function AdminUsersPage({ user, onLogout, onNavigate, darkMode, toggleDarkMode }: AdminUsersPageProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof User; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (updatedUser: User) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/users/${updatedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedUser)
      });
      if (!res.ok) throw new Error('Failed to update user');
      
      setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
      setEditingUser(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleApproval = async (targetUser: User) => {
    const updatedUser = { ...targetUser, isApproved: !targetUser.isApproved };
    await handleUpdateUser(updatedUser);
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to delete user');
      
      setUsers(users.filter(u => u.id !== id));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateResetLink = async () => {
    if (!resetPasswordUser) return;
    setActionLoading(true);
    setResetLink(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/users/${resetPasswordUser.id}/reset-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to generate reset link');
      
      const data = await res.json();
      const link = `${window.location.origin}/?resetToken=${encodeURIComponent(data.token)}`;
      setResetLink(link);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || newPassword.length < 6) return;

    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/users/${resetPasswordUser.id}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPassword })
      });
      if (!res.ok) throw new Error('Failed to reset password');
      
      alert('Password reset successfully');
      setResetPasswordUser(null);
      setNewPassword('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSort = (key: keyof User) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedUsers = useMemo(() => {
    let sortableUsers = [...users];
    if (sortConfig !== null) {
      sortableUsers.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableUsers;
  }, [users, sortConfig]);

  const renderSortIcon = (key: keyof User) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-4 h-4 ml-1 inline-block text-slate-400" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="w-4 h-4 ml-1 inline-block text-blue-600" />;
    }
    return <ArrowDown className="w-4 h-4 ml-1 inline-block text-blue-600" />;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <Header
        user={user}
        currentView="admin"
        onNavigate={onNavigate as any}
        onLogout={onLogout}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        onHelp={() => setShowHelpModal(true)}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">User Management</h1>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg flex items-start gap-3 text-red-700 dark:text-red-400 transition-colors">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors">
                <tr>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('name')}>
                    <div className="flex items-center">Name {renderSortIcon('name')}</div>
                  </th>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('email')}>
                    <div className="flex items-center">Email {renderSortIcon('email')}</div>
                  </th>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('role')}>
                    <div className="flex items-center">Role {renderSortIcon('role')}</div>
                  </th>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('isApproved')}>
                    <div className="flex items-center">Status {renderSortIcon('isApproved')}</div>
                  </th>
                  <th className="px-6 py-4 font-medium">
                    <div className="flex items-center">API Usage (1h/24h/30d)</div>
                  </th>
                  {user.role === 'admin' && (
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {sortedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4">
                      {editingUser?.id === u.id && user.role === 'admin' ? (
                        <input
                          type="text"
                          value={editingUser.name}
                          onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 transition-colors"
                        />
                      ) : (
                        <span className="font-medium text-slate-900 dark:text-slate-100">{u.name}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {editingUser?.id === u.id && user.role === 'admin' ? (
                        <input
                          type="email"
                          value={editingUser.email}
                          onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 transition-colors"
                        />
                      ) : (
                        u.email
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingUser?.id === u.id && user.role === 'admin' ? (
                        <select
                          value={editingUser.role}
                          onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as 'admin' | 'instructor' | 'moderator' })}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 transition-colors"
                        >
                          <option value="instructor">Instructor</option>
                          <option value="moderator">Moderator</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize transition-colors ${
                          u.role === 'admin' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400' : u.role === 'moderator' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                        }`}>
                          {u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleApproval(u)}
                        disabled={actionLoading || u.id === user.id || (user.role === 'moderator' && (u.role === 'admin' || u.role === 'moderator'))}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          u.isApproved 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50' 
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                        } ${actionLoading || u.id === user.id || (user.role === 'moderator' && (u.role === 'admin' || u.role === 'moderator')) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {u.isApproved ? <Check className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5" />}
                        {u.isApproved ? 'Approved' : 'Pending'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono text-sm">
                      {u.apiStats ? (
                        <div className="flex items-center gap-1">
                          <span className={u.apiStats.hour > 0 ? "text-indigo-600 dark:text-indigo-400 font-semibold" : ""}>{u.apiStats.hour}</span>
                          <span className="text-slate-400 dark:text-slate-500">/</span>
                          <span className={u.apiStats.day > 0 ? "text-blue-600 dark:text-blue-400 font-semibold" : ""}>{u.apiStats.day}</span>
                          <span className="text-slate-400 dark:text-slate-500">/</span>
                          <span className={u.apiStats.month > 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : ""}>{u.apiStats.month}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">0 / 0 / 0</span>
                      )}
                    </td>
                    {user.role === 'admin' && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {editingUser?.id === u.id ? (
                            <>
                              <button
                                onClick={() => handleUpdateUser(editingUser)}
                                disabled={actionLoading}
                                className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                                title="Save"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingUser(null)}
                                disabled={actionLoading}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setEditingUser(u)}
                                disabled={actionLoading}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded transition-colors"
                                title="Edit User"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setResetPasswordUser(u)}
                                disabled={actionLoading}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-700 rounded transition-colors"
                                title="Reset Password"
                              >
                                <Key className="w-4 h-4" />
                              </button>
                              {u.id !== user.id && (
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  disabled={actionLoading}
                                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-700 rounded transition-colors"
                                  title="Delete User"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}
      </main>

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden transition-colors">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between transition-colors">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Reset Password</h3>
              <button 
                onClick={() => {
                  setResetPasswordUser(null);
                  setNewPassword('');
                }}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleResetPassword} className="p-6">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                Choose how to reset the password for <span className="font-semibold text-slate-900 dark:text-slate-100">{resetPasswordUser.name}</span> ({resetPasswordUser.email}).
              </p>
              
              <div className="space-y-6">
                <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Option 1: Generate Reset Link</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Generate a magical link that the user can click to securely choose their own password. The link is valid for 24 hours.
                  </p>
                  
                  {resetLink ? (
                    <div className="space-y-2">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/30 rounded text-xs break-all font-mono">
                        {resetLink}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(resetLink);
                          alert('Link copied to clipboard!');
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
                      >
                        Copy Link
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGenerateResetLink}
                      disabled={actionLoading}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-sm font-medium py-1.5 px-3 rounded-lg transition-colors flex items-center gap-2"
                    >
                      {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Generate Link
                    </button>
                  )}
                </div>

                <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Option 2: Set Manually</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Manually set a temporary password and tell it to the user.
                  </p>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-colors"
                    minLength={6}
                    placeholder="Minimum 6 characters"
                  />
                  
                  <div className="mt-3 flex justify-end">
                    <button
                      type="submit"
                      disabled={actionLoading || newPassword.length < 6}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white text-sm font-medium py-1.5 px-4 rounded-lg transition-colors flex items-center gap-2"
                    >
                      {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Reset Password
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setResetPasswordUser(null);
                    setNewPassword('');
                    setResetLink(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showHelpModal && (
        <HelpModal onClose={() => setShowHelpModal(false)} />
      )}
    </div>
  );
}
