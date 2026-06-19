import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Home    from './pages/Home.jsx';
import AddTask from './pages/AddTask.jsx';
import History from './pages/History.jsx';
import './App.css';

const IconToday = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <rect x="2" y="4" width="18" height="16" rx="4" stroke="currentColor" strokeWidth="1.6" fill="none"/>
    <path d="M7 2v4M15 2v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M2 9h18" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="6" y="12.5" width="2.5" height="2.5" rx="0.6" fill="currentColor"/>
    <rect x="10.5" y="12.5" width="2.5" height="2.5" rx="0.6" fill="currentColor"/>
  </svg>
);

const IconAdd = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.6" fill="none"/>
    <path d="M11 7v8M7 11h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
  </svg>
);

const IconHistory = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.6" fill="none"/>
    <path d="M11 7v4.5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function AppShell() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <div className={`app${isHome ? ' app--home' : ''}`}>
      <header className="app-header">
        <span className="app-logo">🦁</span>
        <h1 className="app-title">StayWithYou</h1>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/"        element={<Home />}    />
          <Route path="/add"     element={<AddTask />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>

      <nav className="app-nav">
        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <span className="nav-icon"><IconToday /></span>
          <span>Today</span>
        </NavLink>
        <NavLink to="/add" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <span className="nav-icon"><IconAdd /></span>
          <span>Add</span>
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <span className="nav-icon"><IconHistory /></span>
          <span>History</span>
        </NavLink>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
