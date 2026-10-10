export type NextAction = 'photo' | 'video' | 'gallery';

export function go(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function requireSignIn(action: NextAction) {
  sessionStorage.setItem('clockit-next', action);
  go('/login');
}

export function takeNextAction(): NextAction | null {
  const value = sessionStorage.getItem('clockit-next');
  sessionStorage.removeItem('clockit-next');
  if (value === 'photo' || value === 'video' || value === 'gallery') return value;
  return null;
}
