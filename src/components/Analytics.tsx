import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Timetable, TimetableEntry } from '../types';
import { api } from '../lib/api';
import { AlertCircle, TrendingUp, Users, MapPin } from 'lucide-react';

interface AnalyticsProps {
  timetables: Timetable[];
}

export default function Analytics({ timetables }: AnalyticsProps) {
  const [data, setData] = useState<any>(null);
  const latestTimetable = timetables[timetables.length - 1];

  useEffect(() => {
    loadSchema();
  }, [latestTimetable]);

  const loadSchema = async () => {
    const schema = await api.getSchema();
    if (!latestTimetable) return;

    // Teacher load
    const teacherLoad = schema.teachers.map((t: any) => {
      const lectures = latestTimetable.entries.filter(e => e.teacherId === t.id).length;
      const daysCount = schema.days.length || 5;
      const avgDaily = (lectures / daysCount).toFixed(1);
      return { 
        name: t.name.split(' ').pop(), 
        lectures, 
        avgDaily,
        limit: t.maxLecturesPerDay || 4,
        id: t.id
      };
    });

    // Room utilization
    const totalSlots = schema.days.length * schema.slots.filter((s: any) => !s.isBreak).length;
    const roomUtilization = schema.rooms.map((r: any) => {
      const used = latestTimetable.entries.filter(e => e.roomId === r.id).length;
      return { name: r.name, usage: Math.round((used / totalSlots) * 100) };
    });

    setData({ teacherLoad, roomUtilization });
  };

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-slate-800">Teacher Load</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Avg Lectures per Day</p>
            </div>
          </div>
          <TrendingUp className="w-4 h-4 text-slate-300" />
        </div>

        <div className="h-64 mt-4 w-full min-h-[250px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={data.teacherLoad}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
              <YAxis fontSize={9} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="avgDaily" name="Lectures/Day" radius={[4, 4, 0, 0]} barSize={20}>
                {data.teacherLoad.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={parseFloat(entry.avgDaily) > entry.limit ? '#ef4444' : '#4f46e5'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <MapPin className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-slate-800">Room Utilization</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Efficiency rate %</p>
            </div>
          </div>
          <AlertCircle className="w-4 h-4 text-slate-300" />
        </div>

        <div className="h-64 mt-4 w-full min-h-[250px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={data.roomUtilization} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" fontSize={9} axisLine={false} tickLine={false} width={60} tick={{ fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
              <Bar dataKey="usage" background={{ fill: '#f8fafc' }} radius={[0, 4, 4, 0]} barSize={10}>
                {data.roomUtilization.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.usage > 85 ? '#ef4444' : '#10b981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
