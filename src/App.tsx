import { useEffect, useState } from 'react';
import { systemService } from './core/api';
import type { SystemStatus } from './core/types';

export default function App() {
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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center space-y-4">
      <h1 className="text-4xl font-bold">Loom Initialized</h1>
      
      {loading ? (
        <p className="text-slate-400">Loading system status...</p>
      ) : status ? (
        <div className="bg-slate-900 p-6 rounded-lg border border-slate-800" data-testid="system-status">
          <h2 className="text-xl font-semibold mb-2">Core System Status</h2>
          <ul className="space-y-2 text-slate-300">
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
