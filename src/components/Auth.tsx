import React, { useState } from 'react';
import { Train, Loader2, AlertTriangle, Moon, Sun, KeyRound, Mail, ArrowLeft, Copy, Check, ExternalLink } from 'lucide-react';
import { User } from '../types';

interface AuthProps {
  onLogin: (user: User) => void;
  onStartDemo: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  onResetToken?: (token: string) => void;
}

type AuthMode = 'login' | 'register' | 'forgot-password';

export default function Auth({ onLogin, onStartDemo, darkMode, toggleDarkMode, onResetToken }: AuthProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setDevResetUrl(null);
    setCopiedLink(false);
  };

  const handleCopyDevLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleOpenDevLink = (url: string) => {
    try {
      const parsed = new URL(url, window.location.origin);
      const token = parsed.searchParams.get('resetToken');
      if (token && onResetToken) {
        onResetToken(token);
        return;
      }
    } catch (e) {
      // Fallback to location navigation
    }
    window.location.href = url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setError('');
    setSuccess('');
    setDevResetUrl(null);
    setLoading(true);
    
    try {
      if (mode === 'forgot-password') {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() })
        });

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error('Server returned an unexpected response. Please try again later.');
        }

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Password recovery request failed');
        }

        setSuccess(data.message || 'If an account exists with that email, a password reset link has been dispatched.');
        if (data.devResetUrl) {
          setDevResetUrl(data.devResetUrl);
        }
        return;
      }

      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email, password } : { email, password, name };
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('Server returned an unexpected response. Please try again later.');
      }

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }
      
      if (data.message) {
        // Show success message and switch to login
        setError('');
        setSuccess(data.message);
        setMode('login');
        return;
      }

      localStorage.setItem('token', data.token);
      onLogin(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center items-center p-4 transition-colors relative">
      <button 
        onClick={toggleDarkMode}
        className="absolute top-4 right-4 p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-full transition-colors"
        title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 transition-colors">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6 transition-colors">
            {mode === 'forgot-password' ? <KeyRound size={30} /> : <Train size={32} />}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {mode === 'forgot-password' ? 'Recover Password' : 'Instructor Job Allocator'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {mode === 'forgot-password'
              ? 'Enter your account email to receive a password reset link.'
              : mode === 'register'
              ? 'Create an account to access the allocations schedule.'
              : 'Coordinate daily tasks, diagrams, and headcodes.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jane Smith"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-colors"
                required={mode === 'register'}
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-colors"
              required
            />
          </div>
          
          {mode !== 'forgot-password' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot-password')}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-colors"
                required
              />
            </div>
          )}

          {mode === 'register' && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Note: New accounts require administrator approval before logging in.
            </p>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg flex items-start gap-2 text-red-700 dark:text-red-400 text-sm transition-colors">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-lg flex items-start gap-2 text-green-700 dark:text-green-400 text-sm transition-colors">
              <p>{success}</p>
            </div>
          )}

          {/* Development Mock Reset Link Display when SMTP is unconfigured */}
          {devResetUrl && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl text-left space-y-2.5 transition-colors">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-semibold uppercase tracking-wider">
                <Mail className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Local Testing (SMTP Not Configured)</span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300/90 leading-relaxed">
                In production, an email with a reset link is delivered to the user. For development, your reset link is generated below:
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleOpenDevLink(devResetUrl)}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Reset Page
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyDevLink(devResetUrl)}
                  className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 text-xs font-medium py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? 'Copied' : 'Copy URL'}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 mt-6 shadow-xs"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {loading ? 'Please wait...' : (
              mode === 'forgot-password'
                ? 'Send Recovery Link'
                : mode === 'register'
                ? 'Create Account'
                : 'Sign In'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          {mode === 'forgot-password' ? (
            <button
              onClick={() => switchMode('login')}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Sign In
            </button>
          ) : (
            <button
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
            >
              {mode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          )}
        </div>

        {mode !== 'forgot-password' && (
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Just want to look around?</p>
            <button
              type="button"
              onClick={onStartDemo}
              className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              Enter Demo Mode
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
