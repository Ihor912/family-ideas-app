import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/nunito';
import App from './App';
import './styles.css';

async function mount() {
  const services = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true'
    ? (await import('./demo/services')).createDemoServices()
    : undefined;
  createRoot(document.getElementById('root')!).render(
    <StrictMode><App services={services} /></StrictMode>,
  );
}

void mount();
