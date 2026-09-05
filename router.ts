// Simple URL-based router for the app
import { AppView } from './types';

export const urlToView = (pathname: string): AppView => {
  if (pathname.includes('/practice')) return AppView.PRACTICE_ARENA;
  if (pathname.includes('/dashboard')) return AppView.DASHBOARD;
  if (pathname.includes('/interview')) return AppView.INTERVIEW;
  if (pathname.includes('/open-source')) return AppView.OPEN_SOURCE;
  return AppView.LANDING;
};

export const viewToUrl = (view: AppView): string => {
  switch (view) {
    case AppView.PRACTICE_ARENA:
      return '/practice';
    case AppView.DASHBOARD:
      return '/dashboard';
    case AppView.INTERVIEW:
      return '/interview';
    case AppView.OPEN_SOURCE:
      return '/open-source';
    case AppView.LANDING:
    default:
      return '/';
  }
};

// Update URL without page reload
export const updateUrl = (view: AppView) => {
  const url = viewToUrl(view);
  if (typeof window !== 'undefined') {
    window.history.pushState({}, '', url);
  }
};

// Listen to browser back/forward
export const onUrlChange = (callback: (view: AppView) => void) => {
  const handlePopState = () => {
    const view = urlToView(window.location.pathname);
    callback(view);
  };
  
  window.addEventListener('popstate', handlePopState);
  return () => window.removeEventListener('popstate', handlePopState);
};
