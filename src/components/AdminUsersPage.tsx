import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../types';
import { 
  LogOut, Home, Shield, Check, X, Edit2, Trash2, Key, Loader2, 
  AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Moon, Sun, 
  Calendar as CalendarIcon, User as UserIcon, HelpCircle, Users, 
  UserX, ShieldCheck, GraduationCap, CheckCheck
} from 'lucide-react';
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
  const [bulkSuccessMessage, setBulkSuccessMessage] = useState<string | null>(null);
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
      
      setUsers(users.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
      fetchUsers();
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

  const eligiblePendingUsers = useMemo(() => {
    return users.filter(u => {
      if (u.isApproved) return false;
      if (user.role === 'moderator') {
        return u.role === 'instructor';
      }
      return true;
    });
  }, [users, user.role]);

  const handleBulkApprove = async () => {
    if (eligiblePendingUsers.length === 0) return;
    setActionLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/users/bulk-approve', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to bulk approve pending users');
      }
      const data = await res.json();
      setBulkSuccessMessage(`Successfully approved ${data.count || eligiblePendingUsers.length} pending user${(data.count || eligiblePendingUsers.length) === 1 ? '' : 's'}.`);
      setTimeout(() => setBulkSuccessMessage(null), 5000);
      await fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
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

  const formatTimestamp = (timestamp?: string | number | null) => {
    if (!timestamp) return { display: '—', full: 'No record recorded' };
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return { display: '—', full: 'No record recorded' };

      const display = date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }) + ', ' + date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      return { display, full: date.toUTCString() };
    } catch {
      return { display: '—', full: 'No record recorded' };
    }
  };

  const sortedUsers = useMemo(() => {
    let sortableUsers = [...users];

    sortableUsers.sort((a, b) => {
      // Pending approval users are always prioritized at the top of the list
      const aPending = !a.isApproved;
      const bPending = !b.isApproved;
      if (aPending !== bPending) {
        return aPending ? -1 : 1;
      }

      if (sortConfig !== null) {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        if (sortConfig.key === 'lastLoginAt' || sortConfig.key === 'lastAllocationAt' || sortConfig.key === 'last_login_at' || sortConfig.key === 'last_allocation_at') {
          const aTime = new Date(aVal as string).getTime();
          const bTime = new Date(bVal as string).getTime();
          if (isNaN(aTime) && isNaN(bTime)) return 0;
          if (isNaN(aTime)) return 1;
          if (isNaN(bTime)) return -1;
          return sortConfig.direction === 'asc' ? aTime - bTime : bTime - aTime;
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          const comp = aVal.localeCompare(bVal);
          return sortConfig.direction === 'asc' ? comp : -comp;
        }

        if (aVal < bVal) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      }

      return (a.name || '').localeCompare(b.name || '');
    });

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

  const getRoleTextColor = (role?: string, isApproved?: boolean) => {
    if (!isApproved) {
      return 'text-amber-600 dark:text-amber-400';
    }
    switch (role) {
      case 'admin':
        return 'text-purple-600 dark:text-purple-400';
      case 'moderator':
        return 'text-emerald-600 dark:text-emerald-400';
      default:
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  const renderRolePositionSymbol = (role?: string, isApproved?: boolean) => {
    const colorClass = !isApproved 
      ? 'text-amber-600 dark:text-amber-400' 
      : (role === 'admin' 
          ? 'text-purple-600 dark:text-purple-400' 
          : role === 'moderator' 
            ? 'text-emerald-600 dark:text-emerald-400' 
            : 'text-blue-600 dark:text-blue-400');

    switch (role) {
      case 'admin':
        return <Shield className={`w-3.5 h-3.5 ${colorClass} shrink-0`} title="Admin" />;
      case 'moderator':
        return <ShieldCheck className={`w-3.5 h-3.5 ${colorClass} shrink-0`} title="Moderator" />;
      default:
        return <GraduationCap className={`w-3.5 h-3.5 ${colorClass} shrink-0`} title="Instructor" />;
    }
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

      <main className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">User Management</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Overview of all registered platform instructors and administrators.
                </p>
              </div>
            </div>

            {/* Total Users and Pending Approval Counter */}
            {(() => {
              const totalCount = users.length;
              const pendingCount = users.filter(u => !u.isApproved).length;
              const instructorCount = users.filter(u => u.role === 'instructor').length;
              const adminCount = users.filter(u => u.role === 'admin').length;
              const moderatorCount = users.filter(u => u.role === 'moderator').length;

              return (
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4 mb-6">
                  {/* Total Users with Breakdown */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                          Total Users
                        </span>
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                          <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
                          {totalCount}
                        </span>
                        <span className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium">
                          registered
                        </span>
                      </div>
                    </div>

                    {/* Breakdown by user role: Admin, Mod, Inst */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0"></span>
                        <strong className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{adminCount}</strong>
                        <span>Admin</span>
                      </span>

                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <strong className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{moderatorCount}</strong>
                        <span>Mod</span>
                      </span>

                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                        <strong className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{instructorCount}</strong>
                        <span>Inst</span>
                      </span>
                    </div>
                  </div>

                  {/* Pending Approval */}
                  <div className={`rounded-xl p-3 sm:p-4 border shadow-sm transition-colors flex flex-col justify-between ${
                    pendingCount > 0 
                      ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/50' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate ${
                          pendingCount > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                          Pending Approval
                        </span>
                        <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center shrink-0 ${
                          pendingCount > 0 
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' 
                            : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400'
                        }`}>
                          <UserX className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums ${
                          pendingCount > 0 ? 'text-amber-900 dark:text-amber-200' : 'text-slate-900 dark:text-slate-100'
                        }`}>
                          {pendingCount}
                        </span>
                        {pendingCount > 0 ? (
                          <span className="text-[10px] sm:text-xs font-medium text-amber-700 dark:text-amber-300 truncate">
                            action needed
                          </span>
                        ) : (
                          <span className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium truncate">
                            all clear
                          </span>
                        )}
                      </div>
                    </div>

                    {pendingCount > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-amber-200/70 dark:border-amber-800/40 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={handleBulkApprove}
                          disabled={actionLoading || eligiblePendingUsers.length === 0}
                          className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-md bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                          title={`Approve all ${eligiblePendingUsers.length} pending user${eligiblePendingUsers.length === 1 ? '' : 's'} at once`}
                        >
                          {actionLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Approving...</span>
                            </>
                          ) : (
                            <>
                              <CheckCheck className="w-3.5 h-3.5" />
                              <span>Bulk Approve</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {bulkSuccessMessage && (
              <div className="mb-6 p-3.5 sm:p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl flex items-center justify-between gap-3 text-emerald-800 dark:text-emerald-300 transition-colors">
                <div className="flex items-center gap-2.5">
                  <CheckCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-sm font-medium">{bulkSuccessMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkSuccessMessage(null)}
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg flex items-start gap-3 text-red-700 dark:text-red-400 transition-colors">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors">
                <tr>
                  <th className="px-5 py-4 font-medium whitespace-nowrap cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('name')}>
                    <div className="flex items-center">Name {renderSortIcon('name')}</div>
                  </th>
                  <th className="px-5 py-4 font-medium whitespace-nowrap cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('email')}>
                    <div className="flex items-center">Email {renderSortIcon('email')}</div>
                  </th>
                  <th className="px-5 py-4 font-medium whitespace-nowrap cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('lastLoginAt')}>
                    <div className="flex items-center">Last Access {renderSortIcon('lastLoginAt')}</div>
                  </th>
                  <th className="px-5 py-4 font-medium whitespace-nowrap cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('lastAllocationAt')}>
                    <div className="flex items-center">Last Allocation {renderSortIcon('lastAllocationAt')}</div>
                  </th>
                  <th className="px-5 py-4 font-medium whitespace-nowrap">
                    <div className="flex items-center">API Usage (1h/24h/30d)</div>
                  </th>
                  {user.role === 'admin' && (
                    <th className="px-5 py-4 font-medium whitespace-nowrap text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {sortedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      {editingUser?.id === u.id && user.role === 'admin' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingUser.name}
                            onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                            className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 text-sm transition-colors"
                            placeholder="Name"
                          />
                          <select
                            value={editingUser.role}
                            onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as 'admin' | 'instructor' | 'moderator' })}
                            className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 text-xs transition-colors"
                          >
                            <option value="instructor">Instructor</option>
                            <option value="moderator">Moderator</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {/* Symbol representing their position on the left */}
                          <span className="flex items-center shrink-0" title={u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : ''}>
                            {renderRolePositionSymbol(u.role, u.isApproved)}
                          </span>

                          {/* Name colored with pending amber if pending, or role color if approved */}
                          <span className={`font-semibold ${getRoleTextColor(u.role, u.isApproved)}`}>
                            {u.name}
                          </span>

                          {/* Approved / Pending icon on the right */}
                          <button
                            type="button"
                            onClick={() => handleToggleApproval(u)}
                            disabled={actionLoading || u.id === user.id || (user.role === 'moderator' && (u.role === 'admin' || u.role === 'moderator'))}
                            className={`inline-flex items-center justify-center p-0.5 rounded transition-colors ${
                              u.isApproved 
                                ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40' 
                                : 'text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40'
                            } ${actionLoading || u.id === user.id || (user.role === 'moderator' && (u.role === 'admin' || u.role === 'moderator')) ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
                            title={u.isApproved ? "Approved (click to toggle)" : "Pending (click to approve)"}
                          >
                            {u.isApproved ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            ) : (
                              <Loader2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            )}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {editingUser?.id === u.id && user.role === 'admin' ? (
                        <input
                          type="email"
                          value={editingUser.email}
                          onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 transition-colors"
                        />
                      ) : (
                        <span title={u.email} className={u.email && u.email.length > 30 ? "cursor-help" : ""}>
                          {u.email && u.email.length > 30 ? `${u.email.slice(0, 30)}…` : u.email}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-xs font-medium text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                      {(() => {
                        const { display, full } = formatTimestamp(u.lastLoginAt || u.last_login_at);
                        return (
                          <span title={full} className={display === '—' ? 'text-slate-400 dark:text-slate-500' : ''}>
                            {display}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-4 text-xs font-medium text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                      {(() => {
                        const { display, full } = formatTimestamp(u.lastAllocationAt || u.last_allocation_at);
                        return (
                          <span title={full} className={display === '—' ? 'text-slate-400 dark:text-slate-500' : ''}>
                            {display}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs tabular-nums whitespace-nowrap">
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
                      <td className="px-5 py-4 text-right whitespace-nowrap">
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
                    <td colSpan={user.role === 'admin' ? 6 : 5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
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
