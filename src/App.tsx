import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { systemService } from './core/api';
import type { SystemStatus } from './core/types';
import Kanban from './Kanban';

function Home() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      try {
        const result = await systemService.getStatus();
        setStatus(result);
      } catch (err) {
        console.error('Failed to get status:', err);
      } finally {
        setLoading(false);
      }
    }
    
    checkStatus();
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center space-y-4">
      <h1 className="text-4xl font-bold text-center">
        Loom Initialized
        <br />
        <Link to="/kanban" className="text-sm font-medium text-[#00F2FF] mt-4 inline-block tracking-wider px-4 uppercase hover:brightness-110">
          View Kanban Board
        </Link>
      </h1>
      
      {loading ? (
        <p className="text-zinc-400">Loading system status...</p>
      ) : status ? (
        <div className="bg-[#111111] p-6 rounded-lg border border-zinc-800" data-testid="system-status">
          <h2 className="text-xl font-semibold mb-2 text-[#00F2FF]">Core System Status</h2>
          <ul className="space-y-2 text-zinc-300 font-mono">
            <li>
              Status: <span className={status.status === 'online' ? 'text-green-400' : 'text-red-400'}>{status.status}</span>
            </li>
            <li>Version: {status.version}</li>
            <li>Modules: {status.active_modules.join(', ') || 'None'}</li>
          </ul>
        </div>
      ) : (
        <p className="text-red-400">Failed to load system status.</p>
      )}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/kanban" element={<Kanban />} />
      </Routes>
    </BrowserRouter>
  );
}
