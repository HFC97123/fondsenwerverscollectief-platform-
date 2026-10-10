import React from 'react';
import { createRoot } from 'react-dom/client';
import LedenReviews from '../../../src/shared/ui/LedenReviews.jsx';

createRoot(document.getElementById('root')).render(
  <div style={{ background: '#F7F9F8', fontFamily: 'system-ui', minHeight: 200 }}><LedenReviews /></div>,
);
