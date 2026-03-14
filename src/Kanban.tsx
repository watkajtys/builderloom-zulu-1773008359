import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import PocketBase from 'pocketbase';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// API Configuration
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.protocol + "//" + window.location.hostname + ":8092";
  }
  return 'http://zulu-pocketbase:8090';
};

const pb = new PocketBase(getApiUrl());

interface Task {
  id: string;
  title: string;
  status: 'backlog' | 'analysis' | 'synthesizing' | 'validation';
  order: number;
}

// Droppable Column Component
function SortableColumn({ id, children, className }: { id: string, children: React.ReactNode, className: string }) {
  const { setNodeRef } = useDroppable({
    id,
    data: {
      type: 'Column',
    },
  });

  return (
    <div ref={setNodeRef} className={className} id={id}>
      {children}
    </div>
  );
}

// Sortable Item Component
function SortableTask({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'Task', task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  const isInProgress = task.status === 'analysis' || task.status === 'synthesizing';
  const isDone = task.status === 'validation';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-dnd-kit-draggable
      className={`bg-[#111111] p-3 border transition-colors rounded cursor-grab active:cursor-grabbing flex flex-col gap-2 ${
        isDragging ? 'border-[#00F2FF] shadow-[0_0_20px_rgba(0,242,255,0.3)] scale-105 rotate-1 z-50 relative' : 
        isInProgress ? 'border-[#00F2FF]/50 hover:border-[#00F2FF] shadow-[0_0_10px_rgba(0,242,255,0.1)]' : 'border-zinc-800 hover:border-zinc-700'
      } ${isDone && !isDragging ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-mono font-bold tracking-wider ${isInProgress ? 'text-[#00F2FF]/70' : 'text-zinc-600'} ${isDone ? 'line-through' : ''}`}>
          #{task.id.slice(0, 5).toUpperCase()}
        </span>
        <span className={`text-[8px] px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-widest ${
          task.order === 0 ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-zinc-800 text-zinc-400 border border-zinc-700"
        }`}>
          {task.order === 0 ? "P0_CRITICAL" : "P2_NORMAL"}
        </span>
      </div>
      <p className={`text-sm font-medium leading-snug ${isDone ? 'text-zinc-500 line-through' : 'text-white'}`}>{task.title}</p>
      {task.status === 'synthesizing' && (
        <div className="w-full h-1 bg-[#050505] rounded-full overflow-hidden mt-1">
          <div className="h-full bg-[#00F2FF] shadow-[0_0_5px_rgba(0,242,255,1)]" style={{ width: '60%' }}></div>
        </div>
      )}
      {task.status === 'analysis' && (
        <div className="w-full h-1 bg-[#050505] rounded-full overflow-hidden mt-1">
          <div className="h-full bg-[#BC13FE] shadow-[0_0_5px_rgba(188,19,254,0.8)]" style={{ width: '30%' }}></div>
        </div>
      )}
    </div>
  );
}


export default function Kanban() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [pbConnected, setPbConnected] = useState(false);
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    let unsubscribe: () => void;

    async function fetchTasks() {
      try {
        const records = await pb.collection('kanban_tasks').getFullList<Task>({
          sort: 'order',
        });
        setTasks(records);
        setPbConnected(true);
      } catch (err) {
        console.error('Failed to load tasks', err);
        setPbConnected(false);
      } finally {
        setLoading(false);
      }
    }

    fetchTasks();

    pb.collection('kanban_tasks').subscribe<Task>('*', function (e) {
      setPbConnected(true);
      if (isUpdatingRef.current) return;
      if (e.action === 'create') {
        setTasks((prev) => {
            if (prev.find(p => p.id === e.record.id)) return prev;
            return [...prev, e.record].sort((a, b) => a.order - b.order);
        });
      } else if (e.action === 'update') {
        setTasks((prev) => prev.map((t) => (t.id === e.record.id ? e.record : t)).sort((a, b) => a.order - b.order));
      } else if (e.action === 'delete') {
        setTasks((prev) => prev.filter((t) => t.id !== e.record.id));
      }
    }).then(unsub => {
      unsubscribe = unsub;
    }).catch(err => {
      console.warn("Failed to subscribe to real-time events", err);
      setPbConnected(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // require a tiny movement before dragging starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getTasksByStatus = (status: Task['status']) => tasks.filter(t => t.status === status).sort((a, b) => a.order - b.order);
  
  const backlogTasks = useMemo(() => getTasksByStatus('backlog'), [tasks]);
  const analysisTasks = useMemo(() => getTasksByStatus('analysis'), [tasks]);
  const synthesizingTasks = useMemo(() => getTasksByStatus('synthesizing'), [tasks]);
  const validationTasks = useMemo(() => getTasksByStatus('validation'), [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    
    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === "Task";
    const isOverTask = over.data.current?.type === "Task";

    if (!isActiveTask) return;

    // Moving a task over another task
    if (isActiveTask && isOverTask) {
      setTasks(tasks => {
        const activeIndex = tasks.findIndex(t => t.id === activeId);
        const overIndex = tasks.findIndex(t => t.id === overId);

        if (tasks[activeIndex].status !== tasks[overIndex].status) {
          const updatedTasks = [...tasks];
          updatedTasks[activeIndex].status = tasks[overIndex].status;
          return arrayMove(updatedTasks, activeIndex, overIndex);
        }
        return tasks;
      });
    }

    // Moving a task to an empty column
    const isOverColumn = over.data.current?.type === "Column";
    if (isActiveTask && isOverColumn) {
        setTasks(tasks => {
            const activeIndex = tasks.findIndex(t => t.id === activeId);
            const updatedTasks = [...tasks];
            updatedTasks[activeIndex].status = overId as Task['status'];
            return arrayMove(updatedTasks, activeIndex, activeIndex);
        });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    let destinationStatus = activeTask.status;
    
    const overTask = tasks.find(t => t.id === overId);
    if (overTask) {
        destinationStatus = overTask.status;
    } else if (['backlog', 'analysis', 'synthesizing', 'validation'].includes(overId)) {
        destinationStatus = overId as Task['status'];
    }

    let currentTasks = [...tasks];
    const activeIndex = currentTasks.findIndex(t => t.id === activeId);
    
    if (overTask && activeId !== overId) {
        const overIndex = currentTasks.findIndex(t => t.id === overId);
        currentTasks[activeIndex].status = destinationStatus;
        currentTasks = arrayMove(currentTasks, activeIndex, overIndex);
    } else if (!overTask && ['backlog', 'analysis', 'synthesizing', 'validation'].includes(overId)) {
        currentTasks[activeIndex].status = destinationStatus;
    }

    const columnTasks = currentTasks.filter(t => t.status === destinationStatus);
    const updatesToSync: Task[] = columnTasks.map((task, index) => {
        return { ...task, order: index };
    });

    const finalTasks = currentTasks.map(t => {
        const update = updatesToSync.find(u => u.id === t.id);
        return update ? update : t;
    }).sort((a,b) => a.order - b.order);

    setTasks(finalTasks);

    isUpdatingRef.current = true;
    for (const update of updatesToSync) {
        const original = tasks.find(t => t.id === update.id);
        if (original && (original.order !== update.order || original.status !== update.status)) {
            await pb.collection('kanban_tasks').update(update.id, { 
                status: update.status, 
                order: update.order 
            }).catch(console.error);
        }
    }
    setTimeout(() => { isUpdatingRef.current = false; }, 300);
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
      <aside className="w-64 border-r border-zinc-800 flex flex-col bg-[#050505] z-10 relative shrink-0">
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
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                >
                    <div className="flex gap-4 min-h-[400px] w-full overflow-x-auto pb-4 pr-64">
                        <SortableContext items={backlogTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                            <SortableColumn id="backlog" className="flex-1 min-w-[250px] bg-[#050505] border border-zinc-800 rounded p-4 flex flex-col gap-2 min-h-full">
                                <div className="flex justify-between items-center mb-4 px-4">
                                  <h3 className="font-bold text-xs uppercase text-zinc-500 tracking-wider">Backlog</h3>
                                  <span className="text-[10px] font-mono bg-[#111111] border border-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{backlogTasks.length}</span>
                                </div>
                                {backlogTasks.map(task => <SortableTask key={task.id} task={task} />)}
                            </SortableColumn>
                        </SortableContext>

                        <SortableContext items={analysisTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                            <SortableColumn id="analysis" className="flex-1 min-w-[250px] bg-[#050505] border border-zinc-800 rounded p-4 flex flex-col gap-2 min-h-full">
                                <div className="flex justify-between items-center mb-4 px-4">
                                  <h3 className="font-bold text-xs uppercase text-[#BC13FE] tracking-wider drop-shadow-[0_0_5px_rgba(188,19,254,0.5)]">In Analysis</h3>
                                  <span className="text-[10px] font-mono bg-[#BC13FE]/10 border border-[#BC13FE]/30 text-[#BC13FE] px-1.5 py-0.5 rounded">{analysisTasks.length}</span>
                                </div>
                                {analysisTasks.map(task => <SortableTask key={task.id} task={task} />)}
                            </SortableColumn>
                        </SortableContext>

                        <SortableContext items={synthesizingTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                            <SortableColumn id="synthesizing" className="flex-1 min-w-[250px] bg-[#050505] border border-zinc-800 rounded p-4 flex flex-col gap-2 min-h-full">
                                <div className="flex justify-between items-center mb-4 px-4">
                                  <h3 className="font-bold text-xs uppercase text-[#00F2FF] tracking-wider drop-shadow-[0_0_5px_rgba(0,242,255,0.5)]">Synthesizing</h3>
                                  <span className="text-[10px] font-mono bg-[#00F2FF]/10 border border-[#00F2FF]/30 text-[#00F2FF] px-1.5 py-0.5 rounded">{synthesizingTasks.length}</span>
                                </div>
                                {synthesizingTasks.map(task => <SortableTask key={task.id} task={task} />)}
                            </SortableColumn>
                        </SortableContext>

                        <SortableContext items={validationTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                            <SortableColumn id="validation" className="flex-1 min-w-[250px] bg-[#050505] border border-zinc-800 rounded p-4 flex flex-col gap-2 min-h-full">
                                <div className="flex justify-between items-center mb-4 px-4">
                                  <h3 className="font-bold text-xs uppercase text-zinc-500 tracking-wider">Validation</h3>
                                  <span className="text-[10px] font-mono bg-[#111111] border border-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{validationTasks.length}</span>
                                </div>
                                {validationTasks.map(task => <SortableTask key={task.id} task={task} />)}
                            </SortableColumn>
                        </SortableContext>
                    </div>

                    <DragOverlay>
                        {activeTask ? (
                          <div className="rotate-3 scale-105 shadow-[0_0_30px_rgba(0,242,255,0.4)] transition-transform duration-200">
                            <SortableTask task={activeTask} />
                          </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            )}
        </div>
        
        {/* Activity Stream Sidebar */}
        <div className="absolute top-0 right-0 bottom-8 w-64 bg-[#050505] border-l border-zinc-800 hidden xl:flex flex-col z-10 pointer-events-none">
            <div className="p-4 border-b border-zinc-800">
                <h3 className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Activity Stream</h3>
            </div>
            <div className="flex-1 p-4 overflow-hidden flex flex-col gap-3 opacity-50">
                {/* Mock activity entries */}
                <div className="text-[10px] font-mono border-l-2 border-[#00F2FF] pl-2 py-1">
                    <span className="text-[#00F2FF]">10:42:01</span>
                    <p className="text-zinc-400 mt-1">SYS_UPDATE: Re-indexed Synthesizing queue.</p>
                </div>
                <div className="text-[10px] font-mono border-l-2 border-zinc-700 pl-2 py-1">
                    <span className="text-zinc-500">10:39:15</span>
                    <p className="text-zinc-400 mt-1">Task #A8F92 transitioned to In Analysis.</p>
                </div>
                <div className="text-[10px] font-mono border-l-2 border-[#BC13FE] pl-2 py-1">
                    <span className="text-[#BC13FE]">10:15:22</span>
                    <p className="text-zinc-400 mt-1">MEM_ALLOC: High load detected on node 4.</p>
                </div>
                <div className="text-[10px] font-mono border-l-2 border-zinc-700 pl-2 py-1">
                    <span className="text-zinc-500">09:55:00</span>
                    <p className="text-zinc-400 mt-1">Task #B38C1 completed validation.</p>
                </div>
            </div>
        </div>
        
        {/* Status Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-8 border-t border-zinc-800 bg-[#050505] flex items-center justify-between px-4 text-[10px] font-mono font-bold text-zinc-500 z-20">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    <div className={`size-1.5 rounded-full ${pbConnected ? 'bg-[#00F2FF] shadow-[0_0_5px_rgba(0,242,255,0.8)]' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]'}`}></div>
                    <span className={pbConnected ? 'text-[#00F2FF]' : 'text-red-500'}>
                        POCKETBASE_SYNC: {pbConnected ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>
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
