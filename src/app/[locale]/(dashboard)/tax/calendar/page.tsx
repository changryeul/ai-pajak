'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  CheckCircle,
  Bell,
  Filter,
  Loader2,
} from 'lucide-react';

interface TaxEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  taxType: string;
  isAnnual: boolean;
  penalty: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

const priorityConfig = {
  HIGH: { color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500', icon: AlertTriangle },
  MEDIUM: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500', icon: Clock },
  LOW: { color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500', icon: Bell },
};

const taxTypeColors: Record<string, string> = {
  'PPh 21/23': 'from-blue-500 to-blue-600',
  'SPT Masa PPh': 'from-indigo-500 to-indigo-600',
  'PPN': 'from-green-500 to-emerald-600',
  'PPh Final': 'from-amber-500 to-orange-500',
  'SPT Tahunan OP': 'from-purple-500 to-violet-600',
  'SPT Tahunan Badan': 'from-red-500 to-rose-600',
};

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function TaxCalendarPage() {
  const params = useParams();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [year, setYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [events, setEvents] = useState<TaxEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const loadCalendar = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tax/calendar?year=${year}`);
      const data = await res.json();
      if (data.success) {
        setEvents(data.data.events);
      }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [year]);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  // Get events for selected month
  const monthEvents = events.filter(e => {
    const eventMonth = parseInt(e.date.split('-')[1]) - 1;
    if (eventMonth !== selectedMonth) return false;
    if (filter !== 'all' && e.taxType !== filter) return false;
    return true;
  });

  // Get events for selected date
  const dateEvents = selectedDate
    ? events.filter(e => e.date === selectedDate)
    : [];

  // Calendar grid
  const firstDay = new Date(year, selectedMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Get unique tax types for filter
  const taxTypes = [...new Set(events.map(e => e.taxType))];

  // Upcoming events (next 14 days)
  const upcoming = events.filter(e => {
    const eventDate = new Date(e.date);
    const diff = (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 14;
  });

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Calendar className="h-6 w-6 text-blue-600" />
          Kalender Pajak {year}
        </h1>
        <p className="text-gray-500 mt-1">Semua tenggat waktu pajak dalam satu tampilan</p>
      </div>

      {/* Upcoming alerts */}
      {upcoming.length > 0 && (
        <Card className="border-0 shadow-sm border-l-4 border-l-red-500 mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm text-red-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {upcoming.length} deadline dalam 14 hari ke depan
            </h3>
            <div className="flex flex-wrap gap-2">
              {upcoming.slice(0, 5).map(e => (
                <button
                  key={e.id}
                  onClick={() => {
                    setSelectedMonth(parseInt(e.date.split('-')[1]) - 1);
                    setSelectedDate(e.date);
                  }}
                  className="text-xs bg-red-50 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-100 transition-colors"
                >
                  {e.date.slice(5)} - {e.title}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={() => {
                    if (selectedMonth === 0) { setSelectedMonth(11); setYear(y => y - 1); }
                    else setSelectedMonth(m => m - 1);
                  }}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="font-bold text-lg min-w-[180px] text-center">
                    {MONTHS_ID[selectedMonth]} {year}
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => {
                    if (selectedMonth === 11) { setSelectedMonth(0); setYear(y => y + 1); }
                    else setSelectedMonth(m => m + 1);
                  }}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-[160px] text-xs">
                      <Filter className="h-3 w-3 mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Jenis</SelectItem>
                      {taxTypes.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : (
                <>
                  {/* Day headers */}
                  <div className="grid grid-cols-7 mb-2">
                    {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => (
                      <div key={d} className="text-center text-xs font-medium text-gray-400 py-2">{d}</div>
                    ))}
                  </div>

                  {/* Calendar days */}
                  <div className="grid grid-cols-7 gap-1">
                    {/* Empty cells for first week */}
                    {Array.from({ length: firstDay }, (_, i) => (
                      <div key={`empty-${i}`} className="aspect-square" />
                    ))}

                    {/* Day cells */}
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1;
                      const dateStr = `${year}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const dayEvents = events.filter(e => e.date === dateStr && (filter === 'all' || e.taxType === filter));
                      const isToday = dateStr === todayStr;
                      const isSelected = dateStr === selectedDate;
                      const isPast = new Date(dateStr) < today && !isToday;

                      return (
                        <button
                          key={day}
                          onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                          className={`aspect-square rounded-xl p-1 flex flex-col items-center justify-start transition-all text-sm ${
                            isSelected ? 'bg-blue-600 text-white shadow-md' :
                            isToday ? 'bg-blue-50 border-2 border-blue-500 font-bold' :
                            dayEvents.length > 0 ? 'hover:bg-gray-100 cursor-pointer' :
                            'text-gray-400 hover:bg-gray-50'
                          } ${isPast && !isSelected ? 'opacity-50' : ''}`}
                        >
                          <span className={`text-xs ${isSelected ? 'text-white' : isToday ? 'text-blue-700' : ''}`}>
                            {day}
                          </span>
                          {dayEvents.length > 0 && (
                            <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                              {dayEvents.slice(0, 3).map((e, idx) => (
                                <div
                                  key={idx}
                                  className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : priorityConfig[e.priority].dot}`}
                                />
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-gray-500">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> Prioritas Tinggi</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500" /> Sedang</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Informasi</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Event List */}
        <div className="space-y-4">
          {/* Selected date events */}
          {selectedDate && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dateEvents.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">Tidak ada deadline</p>
                ) : (
                  <div className="space-y-2">
                    {dateEvents.map(e => {
                      const config = priorityConfig[e.priority];
                      const gradient = taxTypeColors[e.taxType] || 'from-gray-500 to-gray-600';
                      return (
                        <div key={e.id} className={`rounded-xl p-3 border ${config.color}`}>
                          <div className="flex items-start gap-2">
                            <div className={`p-1.5 rounded-lg bg-gradient-to-br ${gradient} flex-shrink-0 mt-0.5`}>
                              <config.icon className="h-3 w-3 text-white" />
                            </div>
                            <div>
                              <p className="font-medium text-xs">{e.title}</p>
                              <p className="text-[10px] mt-0.5 opacity-75">{e.description}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{e.taxType}</Badge>
                                {e.isAnnual && <Badge className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700">Tahunan</Badge>}
                              </div>
                              <p className="text-[10px] text-red-600 mt-1">Denda: {e.penalty}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Month event list */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Deadline {MONTHS_ID[selectedMonth]} ({monthEvents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {monthEvents.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">Tidak ada deadline bulan ini</p>
                ) : (
                  monthEvents.map(e => {
                    const config = priorityConfig[e.priority];
                    const isPast = new Date(e.date) < today;
                    return (
                      <button
                        key={e.id}
                        onClick={() => setSelectedDate(e.date)}
                        className={`w-full text-left flex items-center gap-2 rounded-lg p-2 hover:bg-gray-50 transition-colors ${isPast ? 'opacity-40' : ''}`}
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{e.title}</p>
                          <p className="text-[10px] text-gray-500">{e.date.slice(5)}</p>
                        </div>
                        {isPast && <CheckCircle className="h-3 w-3 text-green-400 flex-shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
