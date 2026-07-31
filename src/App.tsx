/**
 * App — tiny hash router.
 *   #/settings → Lark connection settings · anything else → the dashboard.
 */
import { useEffect, useState } from 'react';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';

function useHashRoute(): 'settings' | 'dashboard' {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash.replace(/^#\/?/, '').startsWith('settings') ? 'settings' : 'dashboard';
}

export default function App() {
  const route = useHashRoute();
  return route === 'settings' ? <SettingsPage /> : <DashboardPage />;
}
