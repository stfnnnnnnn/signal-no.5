import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/bridge';
import './styles.css';
import { App } from './app/App';
import { applySettings, loadSettings } from './state/settings';
import { directives } from './state/directiveStore';

applySettings(loadSettings());
directives.attach();

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
