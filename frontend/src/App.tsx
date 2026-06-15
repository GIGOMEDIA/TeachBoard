import { useState } from 'react';
import { useStore } from './store/useStore';
import Login from './components/auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import Classroom from './components/classroom/Classroom';

type ViewName = 'dashboard' | 'classroom';

export default function App() {
  const { token } = useStore();
  const [view, setView] = useState<ViewName>('dashboard');

  if (!token) {
    return <Login />;
  }

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {view === 'dashboard' ? (
        <Dashboard setView={setView} />
      ) : (
        <Classroom setView={setView} />
      )}
    </div>
  );
}
