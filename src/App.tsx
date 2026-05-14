/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSettingsStore } from './store/settings';
import { Toaster } from '@/components/ui/sonner';

import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import RepoDetails from './pages/RepoDetails';
import Settings from './pages/Settings';

const queryClient = new QueryClient();

// A simple wrapper to protect routes
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isOnboarded = useSettingsStore(state => state.isOnboarded());
  if (!isOnboarded) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const theme = useSettingsStore(state => state.theme);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // Initial redirect based on auth status
  const isOnboarded = useSettingsStore(state => state.isOnboarded());

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to={isOnboarded ? "/dashboard" : "/onboarding"} replace />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/repo/:owner/:repo" element={<ProtectedRoute><RepoDetails /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
