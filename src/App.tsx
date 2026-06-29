import { useEffect, useState } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import AdminUsersPage from './components/AdminUsersPage';
import MyCalendar from './components/MyCalendar';
import ResetPassword from './components/ResetPassword';
import DemoApp from './components/DemoApp';
import FindJobs from './components/FindJobs';
import { Loader2 } from 'lucide-react';
import { User } from './types';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'admin' | 'profile' | 'calendar' | 'find-jobs'>('dashboard');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resetToken');
    if (token) setResetToken(token);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user);
        else localStorage.removeItem('token');
      })
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  if (resetToken) {
    return <ResetPassword token={resetToken} darkMode={darkMode} onComplete={() => {
      window.history.replaceState({}, document.title, window.location.pathname);
      setResetToken(null);
    }} />
  }

  if (isDemoMode) {
    return <DemoApp onExit={() => setIsDemoMode(false)} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
  }

  if (!user) {
    return <Auth onLogin={setUser} onStartDemo={() => setIsDemoMode(true)} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setCurrentView('dashboard');
  };

  if (currentView === 'profile') {
    return <Profile user={user} onLogout={handleLogout} onNavigate={setCurrentView as any} darkMode={darkMode} toggleDarkMode={toggleDarkMode} onUpdateUser={setUser} />;
  }

  if (currentView === 'calendar') {
    return <MyCalendar user={user} onNavigate={setCurrentView as any} onLogout={handleLogout} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
  }

  if (currentView === 'find-jobs') {
    return <FindJobs user={user} onNavigate={setCurrentView as any} onLogout={handleLogout} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
  }

  if (currentView === 'admin' && (user.role === 'admin' || user.role === 'moderator')) {
    return <AdminUsersPage user={user} onLogout={handleLogout} onNavigate={setCurrentView as any} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} onNavigate={setCurrentView as any} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
}
