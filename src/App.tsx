/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { User } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Chatbot from './components/Chatbot';
import { setAuthToken } from './lib/api';
import { PersistenceProvider } from './contexts/PersistenceContext';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Clear any legacy tokens previously persisted in browser storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    const handleAuthFailure = () => {
      setAuthToken(null);
      setUser(null);
    };

    window.addEventListener('auth-failure', handleAuthFailure);
    return () => window.removeEventListener('auth-failure', handleAuthFailure);
  }, []);

  const handleLogin = (userData: User, token: string) => {
    setAuthToken(token);
    setUser(userData);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <PersistenceProvider>
      <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
        <Sidebar 
          user={user} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
        />
        
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <Header 
            user={user} 
            isDarkMode={isDarkMode} 
            setIsDarkMode={setIsDarkMode} 
            onLogout={handleLogout} 
          />
          
          <main className="flex-1 overflow-y-auto p-6 lg:p-8">
            <div className="max-w-7xl mx-auto h-full">
              <Dashboard 
                user={user} 
                activeTab={activeTab} 
                setActiveTab={setActiveTab}
              />
            </div>
          </main>

          <footer className="bg-white border-t border-slate-200 px-8 py-2 flex justify-between items-center text-[10px] text-slate-400 font-medium tracking-wide uppercase">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Logic Server Online</span>
              <span>v4.2.0-Production</span>
            </div>
            <div>
              &copy; 2026 EDU-GEN AI Systems
            </div>
          </footer>
        </div>

        <Chatbot user={user} />
      </div>
    </PersistenceProvider>
  );
}
