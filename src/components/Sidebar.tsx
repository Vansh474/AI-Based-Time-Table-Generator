import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  BookOpen, 
  Settings as SettingsIcon, 
  Bell, 
  HelpCircle,
  Hash,
  Clock,
  CloudCheck,
  CloudAlert,
  RefreshCw
} from 'lucide-react';
import { User } from '../types';
import { cn } from '../lib/utils';
import { usePersistence } from '../contexts/PersistenceContext';

interface SidebarProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ user, activeTab, setActiveTab }: SidebarProps) {
  const isAdmin = user.role === 'admin';
  const { syncStatus } = usePersistence();

  const menuItems = [ { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'timetable', label: 'Timetables', icon: Calendar },
    ...(isAdmin ? [
      { id: 'subjects', label: 'Subjects', icon: BookOpen },
      { id: 'teachers', label: 'Teachers', icon: Users },
      { id: 'rooms', label: 'Classrooms', icon: Hash },
      { id: 'sections', label: 'Sections', icon: LayoutDashboard },
      { id: 'slots', label: 'Time Slots', icon: Clock },
      { id: 'settings', label: 'Settings', icon: SettingsIcon }
    ] : []),
  ];

  return (
    <div className="w-64 h-full bg-white border-r border-slate-200 flex flex-col p-4 z-40 transition-colors">
      <div className="flex items-center gap-3 px-2 mb-10">
        <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold shadow-sm">
          S
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-800">SmartTimetable <span className="text-indigo-600 font-bold">AI</span></h1>
      </div>

      <nav className="flex-1 space-y-1">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold px-3 mb-4">Main Menu</p>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group text-sm font-medium",
              activeTab === item.id 
                ? "bg-indigo-50 text-indigo-700" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <item.icon className={cn(
              "w-4 h-4",
              activeTab === item.id ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
            )} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-auto space-y-1 pt-6 border-t border-slate-100">
        <div className="px-3 py-3 mb-2 rounded-lg bg-slate-50 border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cloud Sync</span>
            {syncStatus === 'synced' ? (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                <CloudCheck className="w-3 h-3" />
                SECURE
              </span>
            ) : syncStatus === 'syncing' ? (
              <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600">
                <RefreshCw className="w-3 h-3 animate-spin" />
                SYNCING
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600">
                <CloudAlert className="w-3 h-3" />
                ERROR
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">All configuration and schedules are backed up.</p>
        </div>
        
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all text-sm font-medium">
          <Bell className="w-4 h-4 text-slate-400" />
          Notifications
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all text-sm font-medium">
          <HelpCircle className="w-4 h-4 text-slate-400" />
          Help Center
        </button>
      </div>
    </div>
  );
}
