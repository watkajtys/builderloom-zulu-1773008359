import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PocketBase from 'pocketbase';

// API Configuration
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.protocol + "//" + window.location.hostname + ":8090";
  }
  return 'http://zulu-pocketbase:8090'; // User instruction uses zulu-pocketbase
};

const pb = new PocketBase(getApiUrl());

interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  order: number;
}

export default function Kanban() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: () => void;

    async function fetchTasks() {
      try {
        const records = await pb.collection('kanban_tasks').getFullList<Task>({
          sort: 'order',
        });
        setTasks(records);
      } catch (err) {
        console.error('Failed to load tasks', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTasks();

    pb.collection('kanban_tasks').subscribe<Task>('*', function (e) {
      if (e.action === 'create') {
        setTasks((prev) => [...prev, e.record].sort((a, b) => a.order - b.order));
      } else if (e.action === 'update') {
        setTasks((prev) => prev.map((t) => (t.id === e.record.id ? e.record : t)).sort((a, b) => a.order - b.order));
      } else if (e.action === 'delete') {
        setTasks((prev) => prev.filter((t) => t.id !== e.record.id));
      }
    }).then(unsub => {
      unsubscribe = unsub;
    }).catch(err => {
      console.warn("Failed to subscribe to real-time events", err);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const getTasksByStatus = (status: Task['status']) => tasks.filter(t => t.status === status);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, newStatus: Task['status'], targetId?: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (!draggedId) return;

    const draggedTask = tasks.find(t => t.id === draggedId);
    if (!draggedTask) return;

    // Filter tasks for the new status column
    let columnTasks = tasks.filter(t => t.status === newStatus).sort((a, b) => a.order - b.order);
    
    // Remove the dragged task from columnTasks if it was already in this column
    columnTasks = columnTasks.filter(t => t.id !== draggedId);

    // Calculate the new index based on destination
    let newIndex = columnTasks.length;
    if (targetId) {
      const targetIndex = columnTasks.findIndex(t => t.id === targetId);
      if (targetIndex !== -1) {
        newIndex = targetIndex;
      }
    }

    // Insert the dragged task into the calculated position
    const updatedDraggedTask = { ...draggedTask, status: newStatus };
    columnTasks.splice(newIndex, 0, updatedDraggedTask);

    // Prepare updates using atomic index recalculation based on relative displacement
    const updatesToMake = columnTasks.map((task, index) => {
      return { id: task.id, order: index, status: newStatus };
    });

    // Update UI immediately for reactive consistency (optimistic update)
    setTasks(prev => {
      const newTasks = prev.map(t => {
        const update = updatesToMake.find(u => u.id === t.id);
        if (update) return { ...t, ...update };
        return t;
      });
      return newTasks.sort((a, b) => a.order - b.order);
    });

    // Persist via PocketBase SDK using sequential iteration to prevent db locks
    for (const update of updatesToMake) {
      if (update.id === draggedTask.id && (draggedTask.status !== update.status || draggedTask.order !== update.order)) {
         await pb.collection('kanban_tasks').update(update.id, { status: update.status, order: update.order });
      } else {
         const originalTask = tasks.find(t => t.id === update.id);
         if (originalTask && originalTask.order !== update.order) {
            await pb.collection('kanban_tasks').update(update.id, { order: update.order });
         }
      }
    }
  };

  const renderSidebarItem = (id: string, icon: string, label: string) => {
    const isActive = id === "kanban";
    return (
        <Link 
            to={id === "kanban" ? "/kanban" : "/"} 
            className={`flex items-center gap-3 px-3 py-2 rounded-sm text-sm font-bold transition-all ${
                isActive 
                    ? "bg-[#00F2FF]/10 text-[#00F2FF] border border-[#00F2FF]/30 shadow-[0_0_10px_rgba(0,242,255,0.1)]" 
                    : "text-zinc-500 hover:bg-[#111111] hover:text-zinc-300"
            }`}
        >
            <span className={`material-symbols-outlined text-[18px] ${isActive ? "text-[#00F2FF]" : "text-zinc-500"}`}>{icon}</span>
            {label}
        </Link>
    );
  };

  return (
    <div className="flex h-screen bg-[#050505] text-[#71717a] font-sans relative overflow-hidden z-10">
      <div className="fixed inset-0 pointer-events-none" style={{ background: "linear-gradient(rgba(0, 242, 255, 0.03) 1px, transparent 1px) 0 0 / 100% 4px" }}></div>
      <aside className="w-64 border-r border-zinc-800 flex flex-col bg-[#050505] z-10 relative">
          <div className="p-6 flex items-center gap-3">
              <div className="size-8 bg-[#00F2FF] rounded-sm flex items-center justify-center text-black shadow-[0_0_15px_rgba(0,242,255,0.3)]">
                  <span className="material-symbols-outlined text-xl">deployed_code</span>
              </div>
              <div>
                  <h1 className="font-bold text-sm tracking-tight text-[#00F2FF] drop-shadow-[0_0_8px_rgba(0,242,255,0.8)]">BuilderLoom Zulu</h1>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold font-mono">AI Factory</p>
              </div>
          </div>
          <nav className="flex-1 px-4 space-y-1">
              <div className="text-[10px] font-bold text-zinc-600 uppercase px-3 py-4 tracking-wider">Engineering</div>
              {renderSidebarItem("telemetry", "analytics", "Telemetry")}
              {renderSidebarItem("health", "monitor_heart", "System Health")}
              {renderSidebarItem("kanban", "view_kanban", "Kanban")}
              {renderSidebarItem("roadmap", "map", "Roadmap")}
              
              <div className="text-[10px] font-bold text-zinc-600 uppercase px-3 py-4 tracking-wider">Infrastructure</div>
              {renderSidebarItem("datasets", "database", "Datasets")}
              {renderSidebarItem("modelzoo", "layers", "Model Zoo")}
          </nav>
          <div className="p-4 border-t border-zinc-800">
              <div className="flex items-center gap-3 p-2 rounded-sm bg-[#111111] border border-zinc-800">
                  <div className="size-8 rounded-sm bg-[#00F2FF]/10 flex items-center justify-center border border-[#00F2FF]/30">
                      <span className="material-symbols-outlined text-[#00F2FF] text-sm">bolt</span>
                  </div>
                  <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate text-zinc-300">V3 Optimizer Active</p>
                      <p className="text-[10px] text-zinc-500 font-mono">Efficiency: 88.4%</p>
                  </div>
              </div>
          </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#111111] z-10 relative">
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-[#050505]">
            <div className="flex items-center gap-4">
                <nav className="flex items-center text-sm font-medium text-zinc-500">
                    <span className="hover:text-[#00F2FF] cursor-pointer transition-colors">Projects</span>
                    <span className="material-symbols-outlined text-sm mx-2">chevron_right</span>
                    <span className="text-white font-bold drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] underline underline-offset-4 decoration-zinc-700">Zulu-Core-Main</span>
                </nav>
            </div>
            <div className="flex items-center gap-4">
                <button className="bg-[#00F2FF]/10 text-[#00F2FF] border border-[#00F2FF]/30 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 hover:bg-[#00F2FF]/20 transition-all shadow-[0_0_10px_rgba(0,242,255,0.1)]">
                    <span className="material-symbols-outlined text-[14px]">tune</span> Global Steer
                </button>
                <div className="relative group flex items-center justify-center">
                    <span className="material-symbols-outlined text-zinc-400 hover:text-[#00F2FF] cursor-pointer transition-colors">notifications</span>
                    <span className="absolute top-0 right-0 size-2 bg-[#00F2FF] rounded-full border-2 border-[#050505] shadow-[0_0_5px_rgba(0,242,255,1)]"></span>
                </div>
                <div className="h-8 w-px bg-zinc-800"></div>
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-xs font-bold text-zinc-300 leading-none">Alex Rivera</p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase font-mono mt-0.5">Arch_Node_01</p>
                    </div>
                    <div className="size-9 rounded-sm bg-[#111111] overflow-hidden ring-1 ring-zinc-800">
                        <div className="w-full h-full bg-[#00F2FF]/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-zinc-300">person</span>
                        </div>
                    </div>
                </div>
            </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 relative">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">Sprint Backlog</h2>
                    <p className="text-zinc-500 mt-1 font-medium font-mono text-sm">Active sprint execution tracking...</p>
                </div>
                <div className="flex gap-2">
                    <button className="bg-[#050505] border border-zinc-800 px-4 py-2 rounded-sm text-sm font-bold flex items-center gap-2 hover:bg-[#111111] transition-colors text-zinc-300">
                        <span className="material-symbols-outlined text-sm">download</span> Export_Raw
                    </button>
                    <button className="bg-[#00F2FF] text-black px-4 py-2 rounded-sm text-sm font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(0,242,255,0.4)] transition-all hover:brightness-110 active:scale-95">
                        <span className="material-symbols-outlined text-sm">add</span> New_Task
                    </button>
                </div>
            </div>
            
            <div className="bg-[#050505] border border-zinc-800 rounded p-8 shadow-lg">
            {loading ? (
                <p className="text-zinc-500 font-mono text-sm">Loading tasks...</p>
            ) : (
                <div className="flex gap-4 min-h-[400px]">
                    <div 
                        className="flex-1 bg-[#050505] border border-zinc-800 rounded p-4 flex flex-col gap-2 min-h-full"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, 'todo')}
                    >
                        <h3 className="font-bold text-xs uppercase text-zinc-500 mb-4 tracking-wider px-4">To Do</h3>
                        {getTasksByStatus('todo').map(task => (
                            <div 
                                key={task.id} 
                                draggable
                                onDragStart={(e) => handleDragStart(e, task.id)}
                                onDrop={(e) => { e.stopPropagation(); handleDrop(e, 'todo', task.id); }}
                                className="bg-[#111111] p-3 border border-zinc-800 hover:border-zinc-700 transition-colors rounded cursor-grab active:cursor-grabbing flex flex-col gap-2"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-zinc-600 font-mono font-bold tracking-wider">#{task.id.slice(0, 5).toUpperCase()}</span>
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-widest ${
                                        task.order === 0 ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                                    }`}>
                                        {task.order === 0 ? "P0_CRITICAL" : "P2_NORMAL"}
                                    </span>
                                </div>
                                <p className="text-sm font-medium text-white leading-snug">{task.title}</p>
                            </div>
                        ))}
                    </div>
                    <div 
                        className="flex-1 bg-[#050505] border border-zinc-800 rounded p-4 flex flex-col gap-2 min-h-full"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, 'in_progress')}
                    >
                        <h3 className="font-bold text-xs uppercase text-[#00F2FF] mb-4 tracking-wider px-4">In Progress</h3>
                        {getTasksByStatus('in_progress').map(task => (
                            <div 
                                key={task.id} 
                                draggable
                                onDragStart={(e) => handleDragStart(e, task.id)}
                                onDrop={(e) => { e.stopPropagation(); handleDrop(e, 'in_progress', task.id); }}
                                className="bg-[#111111] p-3 border border-[#00F2FF]/50 hover:border-[#00F2FF] transition-colors rounded shadow-[0_0_10px_rgba(0,242,255,0.1)] cursor-grab active:cursor-grabbing flex flex-col gap-2"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#00F2FF]/70 font-mono font-bold tracking-wider">#{task.id.slice(0, 5).toUpperCase()}</span>
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-widest ${
                                        task.order === 0 ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                                    }`}>
                                        {task.order === 0 ? "P0_CRITICAL" : "P2_NORMAL"}
                                    </span>
                                </div>
                                <p className="text-sm font-medium text-white leading-snug">{task.title}</p>
                                <div className="w-full h-1 bg-[#050505] rounded-full overflow-hidden mt-1">
                                    <div className="h-full bg-[#00F2FF] shadow-[0_0_5px_rgba(0,242,255,1)]" style={{ width: '60%' }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div 
                        className="flex-1 bg-[#050505] border border-zinc-800 rounded p-4 flex flex-col gap-2 min-h-full"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, 'done')}
                    >
                        <h3 className="font-bold text-xs uppercase text-zinc-500 mb-4 tracking-wider px-4">Done</h3>
                        {getTasksByStatus('done').map(task => (
                            <div 
                                key={task.id} 
                                draggable
                                onDragStart={(e) => handleDragStart(e, task.id)}
                                onDrop={(e) => { e.stopPropagation(); handleDrop(e, 'done', task.id); }}
                                className="bg-[#111111] p-3 border border-zinc-800 hover:border-zinc-700 transition-colors rounded cursor-grab active:cursor-grabbing opacity-70 flex flex-col gap-2"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-zinc-600 font-mono font-bold tracking-wider line-through">#{task.id.slice(0, 5).toUpperCase()}</span>
                                </div>
                                <p className="text-sm font-medium text-zinc-500 line-through leading-snug">{task.title}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
        
        {/* Status Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-8 border-t border-zinc-800 bg-[#050505] flex items-center justify-between px-4 text-[10px] font-mono font-bold text-zinc-500 z-20">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    <div className="size-1.5 rounded-full bg-[#00F2FF] shadow-[0_0_5px_rgba(0,242,255,0.8)]"></div>
                    <span className="text-[#00F2FF]">POCKETBASE_SYNC: CONNECTED</span>
                </div>
                <span>|</span>
                <span>LATENCY: 12ms</span>
            </div>
            <div className="flex items-center gap-4">
                <span>TASKS: {tasks.length}</span>
                <span>|</span>
                <span>DB_VER: 0.21.1</span>
            </div>
        </div>
      </div>
      </main>
    </div>
  );
}
