import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  LayoutDashboard, 
  ChevronLeft, 
  ChevronRight, 
  CheckSquare, 
  Save, 
  Trash2,
  X,
  Briefcase,
  Heart,
  BookOpen,
  DollarSign,
  Star,
  Cake,
  List,
  AlignLeft,
  Trophy,
  Gift,
  Download,
  Loader2
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  type User as FirebaseUser,
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query,
  type QuerySnapshot,
  type DocumentData,
  type FirestoreError
} from 'firebase/firestore';

// =================================================================
// --- CONFIGURACIÓN DE FIREBASE ---
// =================================================================

// 1. Configuración por defecto (Reemplaza con tus datos reales)
const firebaseConfig = {
  apiKey: "AIzaSyAN20gGmcwzYnjOaF7IBEHV6802BCQl4Ac",
  authDomain: "agenda-ed.firebaseapp.com",
  projectId: "agenda-ed",
  storageBucket: "agenda-ed.firebasestorage.app",
  messagingSenderId: "923936510294",
  appId: "1:923936510294:web:f0e757560790428f9b06f7"
};

// 2. Selección de configuración
let finalConfig = defaultOptions;
try {
  // @ts-ignore
  if (typeof __firebase_config !== 'undefined') {
    // @ts-ignore
    finalConfig = JSON.parse(__firebase_config);
  }
} catch (e) {
  // Ignoramos error y usamos defaultOptions
}

// 3. Inicializar
const app = initializeApp(finalConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 4. ID de la App sanitizado
// @ts-ignore
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'agenda-ed-v1';
const appId = rawAppId.replace(/[^a-zA-Z0-9_-]/g, '_');

// --- TIPOS DE DATOS ---

interface AgendaEvent {
  id: string;
  date: string;
  title: string;
  category: string;
  completed: boolean; 
}

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

interface StickyNote {
  id: string;
  title: string;
  color: string;
  rotation: string;
  type: 'text' | 'list';
  content: string;
  items: TodoItem[];
}

interface Goal {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  completedDates: string[];
}

interface CategoryDef {
  id: string;
  label: string;
  icon: React.ElementType; 
  color: string;
}

// --- CONFIGURACIÓN ESTÉTICA ---
const StyleInjector = () => {
  useEffect(() => {
    if (!document.getElementById('font-inter')) {
      const link = document.createElement('link');
      link.id = 'font-inter';
      link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;900&display=swap'; 
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (!document.getElementById('tailwind-script')) {
      const script = document.createElement('script');
      script.id = 'tailwind-script';
      script.src = "https://cdn.tailwindcss.com";
      script.onload = () => {
        const win = window as any;
        if (win.tailwind) {
          win.tailwind.config = {
            theme: {
              extend: {
                fontFamily: { sans: ['Outfit', 'sans-serif'] },
                colors: {
                  dark: { 900: '#0f172a', 800: '#1e293b', 700: '#334155' },
                  brand: { 500: '#6366f1', 400: '#818cf8' } 
                }
              }
            }
          };
        }
      };
      document.head.appendChild(script);
    }
    document.body.style.backgroundColor = '#0f172a';
    document.body.style.color = '#f8fafc';
    document.body.style.fontFamily = "'Outfit', sans-serif";

    const setupPWA = () => {
      let linkIcon = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!linkIcon) {
        linkIcon = document.createElement('link');
        linkIcon.rel = 'icon';
        document.head.appendChild(linkIcon);
      }
      linkIcon.href = '/icono.png'; 

      let linkManifest = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
      if (!linkManifest) {
        linkManifest = document.createElement('link');
        linkManifest.rel = 'manifest';
        linkManifest.href = '/manifest.json';
        document.head.appendChild(linkManifest);
      }

      let metaTheme = document.querySelector("meta[name='theme-color']") as HTMLMetaElement;
      if (!metaTheme) {
        metaTheme = document.createElement('meta');
        metaTheme.name = 'theme-color';
        document.head.appendChild(metaTheme);
      }
      metaTheme.content = '#0f172a';
    };

    setupPWA();
    
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      });
    }

    document.title = "Agenda ED";

  }, []);
  return null;
};

// --- CONSTANTES ---

const CATEGORIES: CategoryDef[] = [
  { id: 'trabajo', label: 'Trabajo', icon: Briefcase, color: 'bg-blue-500' },
  { id: 'personal', label: 'Personal', icon: Star, color: 'bg-purple-500' },
  { id: 'salud', label: 'Salud', icon: Heart, color: 'bg-rose-500' },
  { id: 'estudio', label: 'Estudio', icon: BookOpen, color: 'bg-emerald-500' },
  { id: 'pagos', label: 'Pagos', icon: DollarSign, color: 'bg-amber-500' },
  { id: 'cumpleaños', label: 'Cumpleaños', icon: Cake, color: 'bg-pink-500' },
];

const STICKY_COLORS = [
  'bg-yellow-200 text-black',
  'bg-blue-200 text-black',
  'bg-rose-200 text-black',
  'bg-green-200 text-black',
  'bg-purple-200 text-black',
];

const getTodayStr = () => new Date().toISOString().split('T')[0];

const isSameDate = (eventDate: string, targetDate: string, category: string) => {
  if (category === 'cumpleaños') {
    return eventDate.slice(5) === targetDate.slice(5);
  }
  return eventDate === targetDate;
};

// --- PANTALLAS ---

// 1. MENÚ PRINCIPAL
const MainMenu = ({ onNavigate }: { onNavigate: (view: string) => void }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('Usuario aceptó instalar');
        }
        setDeferredPrompt(null);
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 animate-fade-in relative">
      <h1 className="text-8xl font-black text-cyan-400 mb-12 tracking-tighter drop-shadow-[0_0_15px_rgba(34,211,238,0.6)] select-none">
        {new Date().getFullYear()}
      </h1>

      <div className="grid gap-6 w-full max-w-md z-10">
        {!!deferredPrompt && (
          <button onClick={handleInstallClick} className="bg-white/10 border border-cyan-500/50 text-cyan-400 p-3 rounded-2xl flex items-center justify-center gap-2 mb-2 font-bold animate-pulse">
            <Download size={20} /> Instalar App
          </button>
        )}

        <button onClick={() => onNavigate('today')} className="group relative overflow-hidden bg-slate-800 p-6 rounded-3xl border border-slate-700 hover:border-cyan-400 transition-all duration-300 text-left shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-cyan-500/20 transition-all"></div>
          <CalendarIcon size={32} className="text-cyan-400 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-1">Mi Día</h2>
          <p className="text-slate-400 text-sm">Ver la agenda de hoy</p>
        </button>

        <button onClick={() => onNavigate('schedule')} className="group relative overflow-hidden bg-slate-800 p-6 rounded-3xl border border-slate-700 hover:border-emerald-500 transition-all duration-300 text-left shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
          <Plus size={32} className="text-emerald-400 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-1">Agendar</h2>
          <p className="text-slate-400 text-sm">Programar eventos</p>
        </button>

        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => onNavigate('birthdays')} className="group relative overflow-hidden bg-slate-800 p-4 rounded-3xl border border-slate-700 hover:border-pink-500 transition-all duration-300 text-left shadow-lg">
            <div className="absolute top-0 right-0 w-16 h-16 bg-pink-500/10 rounded-full -mr-6 -mt-6 blur-xl"></div>
            <Gift size={24} className="text-pink-400 mb-2" />
            <h2 className="text-lg font-bold text-white">Cumpleaños</h2>
          </button>

          <button onClick={() => onNavigate('goals')} className="group relative overflow-hidden bg-slate-800 p-4 rounded-3xl border border-slate-700 hover:border-blue-500 transition-all duration-300 text-left shadow-lg">
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full -mr-6 -mt-6 blur-xl"></div>
            <Trophy size={24} className="text-blue-400 mb-2" />
            <h2 className="text-lg font-bold text-white">Objetivos</h2>
          </button>
        </div>

        <button onClick={() => onNavigate('board')} className="group relative overflow-hidden bg-slate-800 p-6 rounded-3xl border border-slate-700 hover:border-amber-500 transition-all duration-300 text-left shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
          <LayoutDashboard size={32} className="text-amber-400 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-1">Cosas por Hacer</h2>
          <p className="text-slate-400 text-sm">Pizarra de notas adhesivas</p>
        </button>
      </div>

      <div className="fixed bottom-6 right-6 text-slate-600 font-bold text-sm tracking-widest opacity-50 hover:opacity-100 transition-opacity cursor-default">
        By ED
      </div>
    </div>
  );
};

// 2. VISTA DEL DÍA
const DailyView = ({ events, onToggleEvent, onBack }: { events: AgendaEvent[], onToggleEvent: (id: string) => void, onBack: () => void }) => {
  const today = getTodayStr();
  const todaysEvents = events.filter(e => isSameDate(e.date, today, e.category));
  const [dateDisplay, setDateDisplay] = useState('');

  useEffect(() => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setDateDisplay(new Date().toLocaleDateString('es-ES', options));
  }, []);

  return (
    <div className="min-h-screen bg-dark-900 p-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-3 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"><ChevronLeft size={24} /></button>
        <div>
          <h2 className="text-3xl font-bold text-white capitalize">Hoy</h2>
          <p className="text-cyan-400 capitalize">{dateDisplay}</p>
        </div>
      </div>
      <div className="space-y-4">
        {todaysEvents.length === 0 ? (
          <div className="text-center py-20 opacity-50">
            <CalendarIcon size={64} className="mx-auto mb-4 text-slate-600" />
            <p className="text-xl">Nada agendado para hoy.</p>
            <p className="text-sm text-slate-500">¡Día libre o a trabajar!</p>
          </div>
        ) : (
          todaysEvents.map(event => {
            const cat = CATEGORIES.find(c => c.id === event.category);
            return (
              <button 
                key={event.id} 
                onClick={() => onToggleEvent(event.id)}
                className={`w-full text-left bg-slate-800 p-5 rounded-2xl border-l-4 shadow-lg flex justify-between items-start animate-slide-up transition-all active:scale-95
                  ${event.completed ? 'opacity-50 border-slate-600 bg-slate-800/50' : 'border-cyan-500'}
                `}
              >
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-1 rounded-md text-white font-medium flex items-center gap-1 ${cat?.color || 'bg-slate-600'}`}>
                      {/* Renderizado seguro */}
                      {cat && React.createElement(cat.icon, { size: 16 })} {cat?.label || 'General'}
                    </span>
                  </div>
                  <h3 className={`text-xl font-bold text-white break-words w-full ${event.completed ? 'line-through text-slate-400' : ''}`}>
                    {event.title}
                  </h3>
                  {event.category === 'cumpleaños' && <p className="text-xs text-pink-400 mt-1">🎂 Se repite cada año</p>}
                </div>
                {event.completed && <CheckSquare className="text-cyan-500" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

// 3. AGENDAR
const SchedulerView = ({ events, onSaveEvent, onDeleteEvent, onBack }: { events: AgendaEvent[], onSaveEvent: (e: AgendaEvent) => void, onDeleteEvent: (id: string) => void, onBack: () => void }) => {
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('trabajo');
  const [viewState, setViewState] = useState<'calendar' | 'form'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); 
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    return { days, startOffset, monthName: date.toLocaleString('es-ES', { month: 'long' }), year };
  };
  const { days, startOffset, monthName, year } = getDaysInMonth(currentMonth);
  const changeMonth = (offset: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentMonth(newDate);
  };
  const handleDaySelect = (day: number) => {
    const m = (currentMonth.getMonth() + 1).toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    const y = currentMonth.getFullYear();
    setSelectedDate(`${y}-${m}-${d}`);
    setViewState('form');
  };
  const handleSave = () => {
    if(!title) return;
    const newEvent: AgendaEvent = { id: Date.now().toString(), date: selectedDate, title, category, completed: false };
    onSaveEvent(newEvent);
    setViewState('calendar');
    setTitle('');
  };
  const eventsOnSelectedDate = events.filter(e => isSameDate(e.date, selectedDate, e.category));

  return (
    <div className="min-h-screen bg-dark-900 p-2 flex flex-col">
      <div className="flex items-center gap-4 mb-4 px-2 mt-2">
        <button onClick={viewState === 'form' ? () => setViewState('calendar') : onBack} className="p-3 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"><ChevronLeft size={24} /></button>
        <h2 className="text-2xl font-bold text-white">{viewState === 'calendar' ? 'Selecciona Fecha' : 'Detalles'}</h2>
      </div>
      
      {viewState === 'calendar' ? (
        <div className="flex-1 bg-slate-800 rounded-3xl p-4 shadow-xl animate-fade-in flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <button onClick={() => changeMonth(-1)} className="p-3 hover:bg-slate-700 rounded-full"><ChevronLeft size={24}/></button>
            <h3 className="text-2xl font-bold capitalize">{monthName} {year}</h3>
            <button onClick={() => changeMonth(1)} className="p-3 hover:bg-slate-700 rounded-full"><ChevronRight size={24}/></button>
          </div>
          
          <div className="grid grid-cols-7 gap-2 text-center mb-2 text-slate-400 text-xl font-bold">
            <div>L</div><div>M</div><div>M</div><div>J</div><div>V</div><div>S</div><div>D</div>
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: days }).map((_, i) => {
              const day = i + 1;
              const checkM = (currentMonth.getMonth() + 1).toString().padStart(2, '0');
              const checkD = day.toString().padStart(2, '0');
              const fullDate = `${year}-${checkM}-${checkD}`;
              const isSelected = fullDate === selectedDate;
              const hasEvents = events.some(e => isSameDate(e.date, fullDate, e.category));
              return (
                <button 
                  key={day} 
                  onClick={() => handleDaySelect(day)} 
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center font-bold transition-all relative
                    ${isSelected ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : 'bg-slate-900 hover:bg-slate-700 text-slate-300'}
                  `}
                >
                  <span className="text-3xl">{day}</span>
                  {hasEvents && !isSelected && <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-1"></div>}
                  {hasEvents && isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full mt-1"></div>}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="animate-slide-up space-y-6 px-4 pt-4">
          <div className="bg-slate-800 p-4 rounded-3xl border border-slate-700">
            <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Ya agendado para hoy:</h4>
            {eventsOnSelectedDate.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Nada por ahora.</p> 
            ) : (
              <div className="space-y-2">
                {eventsOnSelectedDate.map(e => { 
                  const cat = CATEGORIES.find(c => c.id === e.category); 
                  return (
                    <div key={e.id} className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-700/50">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cat?.color}`}></div>
                        <span className={`text-sm text-white truncate ${e.completed ? 'line-through text-slate-500' : ''}`}>{e.title}</span>
                        {e.category === 'cumpleaños' && <span className="text-xs">🎂</span>}
                      </div>
                      <button 
                        onClick={() => { if(confirm('¿Borrar este evento?')) onDeleteEvent(e.id) }}
                        className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ); 
                })}
              </div>
            )}
          </div>

          <div className="bg-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
            <div><label className="text-sm text-slate-400 uppercase font-bold tracking-wider">Fecha</label><div className="text-xl font-bold text-white mt-1">{selectedDate}</div></div>
            <div><label className="text-sm text-slate-400 uppercase font-bold tracking-wider">¿Qué vamos a hacer?</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Tarea importante..." className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 mt-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none" /></div>
            <div><label className="text-sm text-slate-400 uppercase font-bold tracking-wider">Categoría</label><div className="grid grid-cols-3 gap-2 mt-2">
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setCategory(cat.id)} className={`p-3 rounded-xl flex flex-col items-center gap-2 border transition-all ${category === cat.id ? 'border-cyan-500 bg-cyan-500/20 text-white' : 'border-slate-700 bg-slate-900 text-slate-400'}`}>
                  <div className={`${category === cat.id ? 'text-cyan-400' : ''}`}>
                    {/* Renderizado seguro */}
                    {React.createElement(cat.icon, { size: 16 })}
                  </div>
                  <span className="text-xs">{cat.label}</span>
                </button>
              ))}
            </div></div>
            <button onClick={handleSave} className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-4 rounded-xl shadow-lg shadow-cyan-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"><Save size={20} /> Guardar Evento</button>
          </div>
        </div>
      )}
    </div>
  );
};

// 4. CUMPLEAÑOS
const BirthdaysView = ({ events, onBack }: { events: AgendaEvent[], onBack: () => void }) => {
  const birthdays = events.filter(e => e.category === 'cumpleaños');
  const sortedBirthdays = [...birthdays].sort((a, b) => {
    const dateA = a.date.slice(5); 
    const dateB = b.date.slice(5);
    return dateA.localeCompare(dateB);
  });
  const getMonthName = (dateStr: string) => {
    const month = parseInt(dateStr.split('-')[1]) - 1;
    return new Date(2024, month, 1).toLocaleString('es-ES', { month: 'long' });
  };

  return (
    <div className="min-h-screen bg-dark-900 p-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-3 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"><ChevronLeft size={24} /></button>
        <h2 className="text-2xl font-bold text-white">Lista de Cumpleaños</h2>
      </div>
      <div className="space-y-3">
        {sortedBirthdays.length === 0 ? (
          <div className="text-center py-20 text-slate-500"><Cake size={48} className="mx-auto mb-2 opacity-50"/><p>No hay cumpleaños agendados.</p></div>
        ) : (
          sortedBirthdays.map((bday, index) => {
            const currentMonth = getMonthName(bday.date);
            const prevMonth = index > 0 ? getMonthName(sortedBirthdays[index - 1].date) : '';
            const showHeader = currentMonth !== prevMonth;
            return (
              <React.Fragment key={bday.id}>
                {showHeader && <h3 className="text-cyan-400 font-bold uppercase tracking-wider text-sm mt-6 mb-2 ml-1">{currentMonth}</h3>}
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center gap-4 hover:border-pink-500 transition-colors">
                  <div className="bg-pink-500/20 p-3 rounded-full text-pink-400 font-bold text-sm min-w-[50px] text-center">{bday.date.split('-')[2]}</div>
                  <div><h4 className="text-white font-bold text-lg">{bday.title}</h4><p className="text-slate-400 text-xs">Se repite anualmente</p></div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
};

// 5. OBJETIVOS
const GoalsView = ({ goals, onSaveGoal, onUpdateGoal, onDeleteGoal, onBack }: { goals: Goal[], onSaveGoal: (g: Goal) => void, onUpdateGoal: (g: Goal) => void, onDeleteGoal: (id: string) => void, onBack: () => void }) => {
  const [showForm, setShowForm] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null); 
  
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [start, setStart] = useState(getTodayStr());
  const [end, setEnd] = useState(getTodayStr());

  const handleCreate = () => {
    if(!title) return;
    const newGoal: Goal = { id: Date.now().toString(), title, description: desc, startDate: start, endDate: end, completedDates: [] };
    onSaveGoal(newGoal);
    setShowForm(false);
    setTitle(''); setDesc('');
  };

  if (selectedGoalId) {
    const goal = goals.find(g => g.id === selectedGoalId);
    if (goal) {
      return (
        <GoalDetailView 
          goal={goal} 
          onUpdate={onUpdateGoal} 
          onDelete={(id) => { onDeleteGoal(id); setSelectedGoalId(null); }}
          onBack={() => setSelectedGoalId(null)} 
        />
      );
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#22d3ee 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
      <div className="flex items-center justify-between mb-8 relative z-10">
        <button onClick={onBack} className="p-3 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"><ChevronLeft size={24} /></button>
        <h2 className="text-2xl font-bold text-white">Mis Objetivos</h2>
        <button onClick={() => setShowForm(true)} className="p-3 bg-blue-500 rounded-full text-white hover:bg-blue-400 shadow-lg shadow-blue-500/30"><Plus size={24} /></button>
      </div>
      {!showForm ? (
        <div className="grid grid-cols-1 gap-6 relative z-10">
          {goals.length === 0 && <div className="col-span-1 text-center py-20 text-slate-500"><Trophy size={48} className="mx-auto mb-2 opacity-50"/><p>Sin objetivos activos.</p></div>}
          {goals.map(goal => (
            <button 
              key={goal.id} 
              onClick={() => setSelectedGoalId(goal.id)}
              className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg flex flex-col hover:border-blue-500 transition-colors text-left w-full"
            >
              <div className="p-3 bg-slate-900 border-b border-slate-700">
                <h3 className="font-bold text-white text-lg truncate">{goal.title}</h3>
                <p className="text-xs text-slate-400 mt-1">Marca tu progreso</p>
              </div>
              <div className="p-4 opacity-100 pointer-events-none flex justify-center w-full">
                <GoalMiniCalendarPreview goal={goal} /> 
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-slate-800 p-6 rounded-3xl space-y-4 animate-slide-up relative z-10 shadow-2xl border border-slate-700">
          <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-white">Nuevo Objetivo</h3><button onClick={() => setShowForm(false)}><X className="text-slate-400" /></button></div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nombre (ej. Leer 10 min)" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500" />
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción (Opcional)" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500 h-20 resize-none" />
          <div className="grid grid-cols-2 gap-4"><div><label className="text-xs text-slate-400 uppercase font-bold">Inicio</label><input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none mt-1" /></div><div><label className="text-xs text-slate-400 uppercase font-bold">Fin</label><input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none mt-1" /></div></div>
          <button onClick={handleCreate} className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl mt-4 hover:bg-blue-400">¡Listo!</button>
        </div>
      )}
    </div>
  );
};

const GoalMiniCalendarPreview = ({ goal }: { goal: Goal }) => {
  const [currentDate] = useState(new Date()); 
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const startDay = new Date(y, m, 1).getDay();
  const offset = startDay === 0 ? 6 : startDay - 1;

  return (
    <div className="w-full max-w-[280px] mx-auto"> 
      <div className="text-center mb-2 text-xs font-bold uppercase text-slate-400">{currentDate.toLocaleString('es-ES', { month: 'short' })}</div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => <div key={`e-${i}`} />)}
        {/* CORRECCIÓN: Mostramos TODOS los días del mes */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1; const mm = (m + 1).toString().padStart(2, '0'); const dd = day.toString().padStart(2, '0'); const dateStr = `${y}-${mm}-${dd}`;
          const isCompleted = goal.completedDates.includes(dateStr);
          return (
            <div key={day} className={`aspect-square rounded flex items-center justify-center text-[8px] font-bold relative ${isCompleted ? 'bg-emerald-500/50 text-emerald-100' : 'text-slate-600'}`}>
              {day}
              {isCompleted && <div className="absolute inset-0 flex items-center justify-center"><X className="text-red-500 w-full h-full p-px" strokeWidth={2} /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const GoalDetailView = ({ goal, onUpdate, onDelete, onBack }: { goal: Goal, onUpdate: (g: Goal) => void, onDelete: (id: string) => void, onBack: () => void }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  useEffect(() => { const start = new Date(goal.startDate + 'T00:00:00'); setCurrentDate(start); }, []);
  
  const changeMonth = (offset: number) => { const newDate = new Date(currentDate); newDate.setMonth(newDate.getMonth() + offset); setCurrentDate(newDate); };
  
  const getDays = (date: Date) => { const y = date.getFullYear(); const m = date.getMonth(); const daysInMonth = new Date(y, m + 1, 0).getDate(); const startDay = new Date(y, m, 1).getDay(); const offset = startDay === 0 ? 6 : startDay - 1; return { daysInMonth, offset, y, m }; };
  const { daysInMonth, offset, y, m } = getDays(currentDate);
  const monthName = currentDate.toLocaleString('es-ES', { month: 'long' });

  const toggleDay = (day: number) => {
    const mm = (m + 1).toString().padStart(2, '0'); const dd = day.toString().padStart(2, '0'); const dateStr = `${y}-${mm}-${dd}`;
    if (dateStr < goal.startDate || dateStr > goal.endDate) return;
    let newCompleted = [...goal.completedDates]; if (newCompleted.includes(dateStr)) { newCompleted = newCompleted.filter(d => d !== dateStr); } else { newCompleted.push(dateStr); }
    onUpdate({ ...goal, completedDates: newCompleted });
  };

  return (
    <div className="min-h-screen bg-dark-900 p-6 flex flex-col items-center">
      <div className="w-full max-w-md">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-3 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"><ChevronLeft size={24} /></button>
            <div>
              <h2 className="text-2xl font-bold text-white leading-tight">{goal.title}</h2>
              <p className="text-slate-400 text-sm">Progreso</p>
            </div>
          </div>
          <button onClick={() => { if(confirm('¿Eliminar objetivo?')) onDelete(goal.id); }} className="p-3 bg-red-500/10 text-red-500 rounded-full hover:bg-red-500/20"><Trash2 size={24} /></button>
        </div>

        <div className="bg-slate-800 rounded-3xl p-4 shadow-xl w-full flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <button onClick={() => changeMonth(-1)} className="p-4 hover:bg-slate-700 rounded-full"><ChevronLeft size={24}/></button>
            <h3 className="text-2xl font-bold capitalize text-white">{monthName} {y}</h3>
            <button onClick={() => changeMonth(1)} className="p-4 hover:bg-slate-700 rounded-full"><ChevronRight size={24}/></button>
          </div>
          
          <div className="grid grid-cols-7 gap-2 text-center mb-2 text-slate-400 text-lg font-medium"><div>L</div><div>M</div><div>M</div><div>J</div><div>V</div><div>S</div><div>D</div></div>
          
          <div className="grid grid-cols-7 gap-2 flex-1">
            {Array.from({ length: offset }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1; const mm = (m + 1).toString().padStart(2, '0'); const dd = day.toString().padStart(2, '0'); const dateStr = `${y}-${mm}-${dd}`;
              const inRange = dateStr >= goal.startDate && dateStr <= goal.endDate; const isCompleted = goal.completedDates.includes(dateStr);
              
              return (
                <button 
                  key={day} 
                  onClick={() => toggleDay(day)} 
                  disabled={!inRange} 
                  className={`aspect-square rounded-xl flex items-center justify-center text-xl font-bold relative transition-all active:scale-95
                    ${inRange ? 'bg-emerald-900/50 text-emerald-100 border-2 border-emerald-500/50' : 'text-slate-700'}
                    ${!inRange ? 'opacity-30' : ''}
                  `}
                >
                  {day}
                  {isCompleted && (
                    <div className="absolute inset-0 flex items-center justify-center bg-indigo-500/20 rounded-xl">
                      <X className="text-red-500 w-full h-full p-0.5 drop-shadow-lg" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// 6. PIZARRA DE NOTAS
const StickyBoardView = ({ notes, onSaveNote, onDeleteNote, onBack }: { notes: StickyNote[], onSaveNote: (n: StickyNote) => void, onDeleteNote: (id: string) => void, onBack: () => void }) => {
  const [editingNote, setEditingNote] = useState<StickyNote | null>(null);
  const createNewNote = () => { const randomRotation = (Math.random() * 6 - 3).toFixed(1); const randomColor = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)]; const newNote: StickyNote = { id: Date.now().toString(), title: 'Nueva Nota', color: randomColor, rotation: randomRotation, type: 'text', content: '', items: [] }; setEditingNote(newNote); };
  const handleEditNote = (note: StickyNote) => { setEditingNote({...note}); };
  const saveCurrentNote = () => { if(editingNote) { onSaveNote(editingNote); setEditingNote(null); } };
  const toggleMode = () => { if (!editingNote) return; if (editingNote.type === 'text') { const lines = editingNote.content.split('\n').filter(line => line.trim() !== ''); const newItems = lines.map(line => ({ id: Date.now().toString() + Math.random(), text: line, completed: false })); setEditingNote({ ...editingNote, type: 'list', items: newItems }); } else { const textContent = editingNote.items.map(i => i.text).join('\n'); setEditingNote({ ...editingNote, type: 'text', content: textContent }); } };
  const toggleItem = (idx: number) => { if(!editingNote) return; const newItems = [...editingNote.items]; newItems[idx].completed = !newItems[idx].completed; setEditingNote({...editingNote, items: newItems}); };
  const addItem = (text: string) => { if(!editingNote || !text) return; const newItem: TodoItem = { id: Date.now().toString(), text, completed: false }; setEditingNote({...editingNote, items: [...editingNote.items, newItem]}); };
  const deleteItem = (idx: number) => { if(!editingNote) return; const newItems = editingNote.items.filter((_, i) => i !== idx); setEditingNote({...editingNote, items: newItems}); };

  return (
    <div className="min-h-screen bg-[#1a1d26] p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      <div className="flex items-center justify-between mb-8 relative z-10">
        <button onClick={onBack} className="p-3 bg-slate-800 rounded-full text-white hover:bg-slate-700 shadow-lg"><ChevronLeft size={24} /></button>
        <h2 className="text-2xl font-bold text-white">Tablero de Tareas</h2>
        <button onClick={createNewNote} className="p-3 bg-brand-500 rounded-full text-white hover:bg-brand-400 shadow-lg shadow-brand-500/30"><Plus size={24} /></button>
      </div>
      <div className="grid grid-cols-2 gap-4 relative z-10">
        {notes.length === 0 && <div className="col-span-2 text-center py-20 text-slate-500"><LayoutDashboard size={48} className="mx-auto mb-2 opacity-50"/><p>El tablero está vacío. ¡Agrega una nota!</p></div>}
        {notes.map(note => (
          <div key={note.id} onClick={() => handleEditNote(note)} className={`p-4 rounded-sm shadow-xl cursor-pointer hover:scale-105 transition-transform duration-200 min-h-[160px] flex flex-col ${note.color}`} style={{ transform: `rotate(${note.rotation}deg)` }}>
            <div className="w-3 h-3 rounded-full bg-black/20 mx-auto -mt-2 mb-2"></div>
            <h3 className="font-bold text-2xl mb-2 leading-tight line-clamp-2">{note.title}</h3> {/* Titulo mas grande (2xl) */}
            <div className="space-y-1 flex-1 overflow-hidden">
              {/* VISTA PREVIA MAS GRANDE (text-lg) */}
              {note.type === 'text' ? <p className="text-lg whitespace-pre-line line-clamp-6 opacity-80 font-semibold">{note.content}</p> : <>{note.items.slice(0, 3).map((item, i) => (<div key={i} className={`text-lg font-semibold flex items-center gap-1 ${item.completed ? 'opacity-50 line-through' : ''}`}><div className="w-1.5 h-1.5 rounded-full bg-current opacity-60"></div><span className="truncate">{item.text}</span></div>))}{note.items.length > 3 && <div className="text-sm opacity-60 italic">...más items</div>}</>}
            </div>
          </div>
        ))}
      </div>
      {editingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className={`w-full max-w-md rounded-lg shadow-2xl p-6 relative animate-zoom-in ${editingNote.color}`}>
            <button onClick={() => setEditingNote(null)} className="absolute top-2 right-2 p-2 hover:bg-black/10 rounded-full text-current"><X size={24} /></button>
            <input value={editingNote.title} onChange={(e) => setEditingNote({...editingNote, title: e.target.value})} className="bg-transparent text-3xl font-bold w-full outline-none placeholder-current/50 mb-4 border-b border-black/10 pb-2 text-current" placeholder="Título de la nota..." /> {/* Input titulo mas grande (3xl) */}
            <div className="min-h-[200px] mb-4">
              {editingNote.type === 'text' ? (
                // TEXTAREA MAS GRANDE (text-2xl)
                <textarea value={editingNote.content} onChange={(e) => setEditingNote({...editingNote, content: e.target.value})} className="w-full h-[350px] bg-black/5 rounded-lg p-3 outline-none resize-none placeholder-current/50 text-current text-2xl leading-relaxed font-medium" placeholder="Escribe aquí tus ideas..." />
              ) : (
                <>
                  <div className="space-y-2 max-h-[350px] overflow-y-auto mb-4 custom-scrollbar">
                    {editingNote.items.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-2 group">
                        {/* LIST ITEMS MAS GRANDES (text-2xl) */}
                        <button onClick={() => toggleItem(idx)} className={`flex-1 text-left flex items-center gap-3 p-2 rounded hover:bg-black/5 transition-colors ${item.completed ? 'line-through opacity-50' : ''}`}>{item.completed ? <CheckSquare size={24} /> : <div className="w-[24px] h-[24px] border-2 border-current rounded-sm"></div>}<span className="text-2xl font-medium">{item.text}</span></button>
                        <button onClick={() => deleteItem(idx)} className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity"><Trash2 size={24} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input id="newItemInput" placeholder="Nuevo pendiente..." className="flex-1 bg-black/10 rounded-lg px-4 py-3 outline-none focus:bg-black/20 text-current placeholder-current/50 text-xl" onKeyDown={(e) => { if(e.key === 'Enter') { addItem(e.currentTarget.value); e.currentTarget.value = ''; } }} />
                    <button onClick={() => { const input = document.getElementById('newItemInput') as HTMLInputElement; addItem(input.value); input.value = ''; }} className="bg-black/20 hover:bg-black/30 text-current p-2 rounded-lg"><Plus size={24} /></button>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-black/10">
              <button onClick={() => { onDeleteNote(editingNote.id); setEditingNote(null); }} className="text-red-700/70 hover:text-red-800 text-sm font-bold flex items-center gap-1"><Trash2 size={16} /> <span className="hidden sm:inline">Eliminar</span></button>
              <button onClick={toggleMode} className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider bg-black/10 hover:bg-black/20 px-3 py-1.5 rounded-full transition-colors" title={editingNote.type === 'text' ? "Convertir a Lista de Tareas" : "Convertir a Texto Simple"}>{editingNote.type === 'text' ? <><List size={14} /> Crear Listas</> : <><AlignLeft size={14} /> Texto Simple</>}</button>
              <button onClick={saveCurrentNote} className="bg-black/80 hover:bg-black text-white px-6 py-2 rounded-lg font-bold shadow-lg">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---

export default function App() {
  const [view, setView] = useState('home'); 
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  // Manejo del Historial
  useEffect(() => {
    window.history.replaceState({ view: 'home' }, '', '');
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state && state.view) {
        setView(state.view);
      } else {
        setView('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (newView: string) => {
    if (newView !== view) {
      window.history.pushState({ view: newView }, '', '');
      setView(newView);
    }
  };

  const goBack = () => {
    window.history.back();
  };

  // 1. AUTH & INIT (FIREBASE)
  useEffect(() => {
    const initAuth = async () => {
      // @ts-ignore
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
         // @ts-ignore
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. DATA SYNC (FIREBASE)
  useEffect(() => {
    if (!user) return;

    // Listen EVENTS
    const eventsQuery = query(collection(db, 'artifacts', appId, 'users', user.uid, 'events'));
    const unsubEvents = onSnapshot(eventsQuery, (snapshot: QuerySnapshot<DocumentData>) => {
      const loadedEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AgendaEvent));
      setEvents(loadedEvents);
    }, (err: FirestoreError) => console.error("Error events:", err));

    // Listen NOTES
    const notesQuery = query(collection(db, 'artifacts', appId, 'users', user.uid, 'notes'));
    const unsubNotes = onSnapshot(notesQuery, (snapshot: QuerySnapshot<DocumentData>) => {
      const loadedNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StickyNote));
      setNotes(loadedNotes);
    }, (err: FirestoreError) => console.error("Error notes:", err));

    // Listen GOALS
    const goalsQuery = query(collection(db, 'artifacts', appId, 'users', user.uid, 'goals'));
    const unsubGoals = onSnapshot(goalsQuery, (snapshot: QuerySnapshot<DocumentData>) => {
      const loadedGoals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal));
      setGoals(loadedGoals);
    }, (err: FirestoreError) => console.error("Error goals:", err));

    return () => {
      unsubEvents();
      unsubNotes();
      unsubGoals();
    };
  }, [user]);


  // 3. HANDLERS (FIREBASE WRITES)
  
  const handleSaveEvent = async (newEvent: AgendaEvent) => {
    if (!user) return;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'events', newEvent.id), newEvent);
  };
  const handleDeleteEvent = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'events', id));
  };
  const handleToggleEvent = async (id: string) => {
    if (!user) return;
    const evt = events.find(e => e.id === id);
    if (evt) {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'events', id), { ...evt, completed: !evt.completed });
    }
  };

  const handleSaveNote = async (updatedNote: StickyNote) => {
    if (!user) return;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'notes', updatedNote.id), updatedNote);
  };
  const handleDeleteNote = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'notes', id));
  };

  const handleSaveGoal = async (newGoal: Goal) => {
    if (!user) return;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'goals', newGoal.id), newGoal);
  };
  const handleUpdateGoal = async (updatedGoal: Goal) => {
    if (!user) return;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'goals', updatedGoal.id), updatedGoal);
  };
  const handleDeleteGoal = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'goals', id));
  };


  if (!user) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-brand-500"><Loader2 className="animate-spin" size={48} /></div>;

  return (
    <div className="font-sans text-slate-100 bg-slate-950 min-h-screen selection:bg-brand-500/30">
      <StyleInjector />
      {view === 'home' && <MainMenu onNavigate={navigateTo} />}
      {view === 'today' && <DailyView events={events} onToggleEvent={handleToggleEvent} onBack={goBack} />}
      {view === 'schedule' && <SchedulerView events={events} onSaveEvent={handleSaveEvent} onDeleteEvent={handleDeleteEvent} onBack={goBack} />}
      {view === 'board' && <StickyBoardView notes={notes} onSaveNote={handleSaveNote} onDeleteNote={handleDeleteNote} onBack={goBack} />}
      {view === 'birthdays' && <BirthdaysView events={events} onBack={goBack} />}
      {view === 'goals' && <GoalsView goals={goals} onSaveGoal={handleSaveGoal} onUpdateGoal={handleUpdateGoal} onDeleteGoal={handleDeleteGoal} onBack={goBack} />}
    </div>
  );
}