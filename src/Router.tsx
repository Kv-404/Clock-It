import { useEffect, useState } from 'react';
import App from './App';
import AuthPage from './pages/AuthPage';
import NotFound from './pages/NotFound';

function currentPath() {
  const path = window.location.pathname.replace(/\/+$/, '');
  return path || '/';
}

export default function Router() {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);

  if (path === '/') return <App />;
  if (path === '/login') return <AuthPage mode="login" />;
  if (path === '/signup') return <AuthPage mode="signup" />;
  return <NotFound />;
}
