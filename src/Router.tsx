import { useEffect, useState } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
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

  let content;
  if (path === '/') content = <App />;
  else if (path === '/login') content = <AuthPage mode="login" />;
  else if (path === '/signup') content = <AuthPage mode="signup" />;
  else content = <NotFound />;

  return (
    <>
      {content}
      <SpeedInsights />
    </>
  );
}
