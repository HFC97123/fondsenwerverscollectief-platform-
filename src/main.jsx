import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import { startAdres } from './app/adres.js';

// Eerst de adressen (oude #/-links omzetten, links afhandelen), dan de app.
startAdres();

createRoot(document.getElementById('root')).render(<App />);
