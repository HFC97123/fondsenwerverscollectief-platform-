// Het beheerderspaneel.
import React from 'react';
import { WebsiteProvider } from '../website/WebsiteProvider.jsx';
import AdminPage from './AdminPage.jsx';

export default function AdminPortal() {
  return (
    <WebsiteProvider>
      <div
        style={{
          fontFamily: "'Mulish', sans-serif",
          color: '#2E3A38',
          background: '#F7F9F8',
          minHeight: '100vh',
        }}
      >
        <AdminPage />
      </div>
    </WebsiteProvider>
  );
}
