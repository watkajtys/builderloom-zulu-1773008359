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

  return (
    <div className="min-h-screen bg-[#050505] text-[#71717a] font-sans relative overflow-hidden flex flex-col">
      <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-[#050505]">
        <div className="flex items-center gap-4">
          <nav className="flex items-center text-sm font-medium text-zinc-500">
            <Link to="/" className="hover:text-[#00F2FF] tracking-wider px-4 uppercase cursor-pointer transition-colors">
              <span className="material-symbols-outlined align-middle mr-1 text-[18px]">arrow_back</span>
              Home
            </Link>
            <span className="material-symbols-outlined text-sm mx-2">chevron_right</span>
            <span className="text-[#00F2FF] font-bold tracking-wider px-4 uppercase">Sprint Backlog</span>
          </nav>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-8 relative z-10">
        <div className="flex justify-between items-end mb-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-[#00F2FF]">Kanban Board</h2>
                <p className="text-zinc-500 mt-1 font-medium font-mono text-sm">Active sprint execution tracking...</p>
            </div>
        </div>
        
        <div className="bg-[#111111] border border-zinc-800 rounded p-8">
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
                                className="bg-[#111111] p-3 border border-zinc-800 hover:border-zinc-700 transition-colors rounded cursor-grab active:cursor-grabbing"
                            >
                                <p className="text-sm font-medium text-white">{task.title}</p>
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
                                className="bg-[#111111] p-3 border border-[#00F2FF]/50 hover:border-[#00F2FF] transition-colors rounded shadow-[0_0_10px_rgba(0,242,255,0.1)] cursor-grab active:cursor-grabbing"
                            >
                                <p className="text-sm font-medium text-white">{task.title}</p>
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
                                className="bg-[#111111] p-3 border border-zinc-800 hover:border-zinc-700 transition-colors rounded cursor-grab active:cursor-grabbing"
                            >
                                <p className="text-sm font-medium text-zinc-500 line-through">{task.title}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
