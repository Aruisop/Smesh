import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity, ShieldAlert, Users, Server, LogOut,
  Globe, Radio, Shield, Wifi, LayoutDashboard, Map, BarChart3,
  Bell, Settings, Clock, Flame, Box, Eye, Antenna, FileCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import StatsCards from '../components/StatsCards';
import ThreatFeed from '../components/ThreatFeed';
import TopAttackers from '../components/TopAttackers';
import TrafficTimeline from '../components/TrafficTimeline';
import AnomalyChart from '../components/AnomalyChart';
import NetworkTopology from '../components/NetworkTopology';
import AlertInvestigation from '../components/AlertInvestigation';
import SystemHealth from '../components/SystemHealth';
import SeverityDistribution from '../components/SeverityDistribution';
import ThreatHeatmap from '../components/ThreatHeatmap';
import GeoThreatMap from '../components/GeoThreatMap';
import ProtocolBreakdown from '../components/ProtocolBreakdown';
// O-RAN Components
import RANHealthMonitor from '../components/RANHealthMonitor';
import PolicyAuditPanel from '../components/PolicyAuditPanel';
import SecurityPosture from '../components/SecurityPosture';

export default function Dashboard() {
  const { user, logout, api, socket } = useAuth();
  const [stats, setStats] = useState({ total_events: 0, total_alerts: 0, high_threats: 0, active_attackers: 0 });
  const [prevStats, setPrevStats] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeView, setActiveView] = useState('overview');
  const prevStatsRef = useRef(null);

  // REST polling for stats (fallback)
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/stats');
      setPrevStats(prevStatsRef.current);
      prevStatsRef.current = res.data;
      setStats(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  }, [api]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 8000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Socket.IO real-time stats
  useEffect(() => {
    if (!socket) return;
    const handleStats = (data) => {
      setPrevStats(prevStatsRef.current);
      prevStatsRef.current = data;
      setStats(data);
      setLastUpdated(new Date());
    };
    const handleConnect = () => setWsConnected(true);
    const handleDisconnect = () => setWsConnected(false);

    socket.on('stats:update', handleStats);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    if (socket.connected) setWsConnected(true);

    return () => {
      socket.off('stats:update', handleStats);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  const sidebarItems = [
    { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
    { id: 'oran', icon: Antenna, label: 'O-RAN' },
    { id: 'threats', icon: ShieldAlert, label: 'Threat Feed' },
    { id: 'geo', icon: Map, label: 'Geo Map' },
    { id: 'analytics', icon: BarChart3, label: 'Analytics' },
  ];

  // ─── Render the active view ───
  const renderContent = () => {
    switch (activeView) {
      case 'oran':
        return renderORANView();
      default:
        return renderOverviewGrid();
    }
  };

  // ─── O-RAN Dedicated View ───
  const renderORANView = () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(12, 1fr)',
      gap: '1rem',
    }}>
      {/* Security Posture (4 cols) + RAN Health (8 cols) */}
      <div className="glass-panel slide-in" style={{ gridColumn: 'span 4', padding: '1rem', animationDelay: '0.05s' }}>
        <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>
          <Shield size={16} color="var(--accent-cyan)" /> Security Posture
        </h3>
        <div style={{ height: '280px' }}>
          <SecurityPosture api={api} />
        </div>
      </div>

      <div className="glass-panel slide-in" style={{ gridColumn: 'span 8', padding: '1rem', animationDelay: '0.08s' }}>
        <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
          <h3 className="section-title">
            <Antenna size={16} color="var(--accent-blue)" /> RAN Cell Health — O1 Telemetry
          </h3>
          <span className="mitre-inline-tag" style={{
            background: 'rgba(6, 182, 212, 0.1)',
            borderColor: 'rgba(6, 182, 212, 0.25)',
            color: 'var(--accent-cyan)',
          }}>
            <Radio size={10} /> TS 28.552 PM Counters
          </span>
        </div>
        <div style={{ height: '280px' }}>
          <RANHealthMonitor api={api} />
        </div>
      </div>

      {/* A1 Policy Audit Panel (full width) */}
      <div className="glass-panel slide-in" style={{ gridColumn: 'span 12', padding: '1rem', animationDelay: '0.12s' }}>
        <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
          <h3 className="section-title">
            <FileCheck size={16} color="var(--accent-purple)" /> A1 Policy Zero-Trust Audit Engine
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="mitre-inline-tag" style={{
              background: 'rgba(139, 92, 246, 0.1)',
              borderColor: 'rgba(139, 92, 246, 0.25)',
              color: 'var(--accent-purple)',
            }}>
              RAG-Enhanced Validation
            </span>
            <span className="mitre-inline-tag">
              <Shield size={10} /> O-RAN TS 803
            </span>
          </div>
        </div>
        <div style={{ height: '340px' }}>
          <PolicyAuditPanel api={api} />
        </div>
      </div>

      {/* Threat Feed (6 cols) + Severity (6 cols) — filtered to telecom domain */}
      <div className="glass-panel slide-in" style={{
        gridColumn: 'span 6', padding: '1rem', animationDelay: '0.15s',
        height: '350px', display: 'flex', flexDirection: 'column',
      }}>
        <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
          <h3 className="section-title">
            <Flame size={16} color="var(--status-high)" /> Telecom Threat Feed
          </h3>
          <span className="mitre-inline-tag" style={{
            background: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.25)',
            color: 'var(--status-high)',
          }}>
            MITRE FiGHT
          </span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ThreatFeed api={api} socket={socket} onInvestigate={setSelectedAlert} />
        </div>
      </div>

      <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="glass-panel slide-in" style={{ padding: '1rem', animationDelay: '0.18s', flex: 1 }}>
          <h3 className="section-title" style={{ marginBottom: '0.5rem' }}>
            <BarChart3 size={16} color="var(--accent-purple)" /> Severity Distribution
          </h3>
          <SeverityDistribution api={api} />
        </div>
        <div className="glass-panel slide-in" style={{ padding: '1rem', animationDelay: '0.2s', flex: 1 }}>
          <h3 className="section-title" style={{ marginBottom: '0.5rem' }}>
            <Eye size={16} color="var(--status-suspicious)" /> Threat Activity Heatmap
          </h3>
          <ThreatHeatmap api={api} />
        </div>
      </div>
    </div>
  );

  // ─── Overview Grid (default) ───
  const renderOverviewGrid = () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(12, 1fr)',
      gap: '1rem',
    }}>
      {/* Row 1: Geo Map (8 cols) + System Health + Security Posture (4 cols) */}
      <div className="glass-panel slide-in" style={{ gridColumn: 'span 8', padding: '1rem', animationDelay: '0.05s' }}>
        <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
          <h3 className="section-title">
            <Map size={16} color="var(--accent-cyan)" /> Threat Intelligence Map
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="real-time-badge">
              <Radio size={10} style={{ marginRight: '4px' }} />
              {wsConnected ? 'Live' : 'Polling'}
            </span>
          </div>
        </div>
        <div style={{ height: '240px' }}>
          <GeoThreatMap api={api} />
        </div>
      </div>

      <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="glass-panel slide-in" style={{ padding: '1rem', animationDelay: '0.08s', flex: 1 }}>
          <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>
            <Shield size={16} color="var(--accent-cyan)" /> Security Posture
          </h3>
          <SecurityPosture api={api} />
        </div>
      </div>

      {/* Row 2: Timeline (8 cols) + System Health (4 cols) */}
      <div className="glass-panel slide-in" style={{ gridColumn: 'span 8', padding: '1rem', animationDelay: '0.1s' }}>
        <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
          <h3 className="section-title">
            <Activity size={16} color="var(--accent-blue)" /> Traffic Activity Timeline
          </h3>
        </div>
        <div style={{ height: '200px' }}>
          <TrafficTimeline api={api} />
        </div>
      </div>

      <div className="glass-panel slide-in" style={{ gridColumn: 'span 4', padding: '1rem', animationDelay: '0.12s' }}>
        <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>
          <Box size={16} color="var(--accent-emerald)" /> System Health
        </h3>
        <SystemHealth api={api} wsConnected={wsConnected} />
      </div>

      {/* Row 3: Threat Feed (6 cols) + Heatmap + Severity (6 cols) */}
      <div className="glass-panel slide-in" style={{
        gridColumn: 'span 6', padding: '1rem', animationDelay: '0.15s',
        height: '400px', display: 'flex', flexDirection: 'column',
      }}>
        <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
          <h3 className="section-title">
            <Flame size={16} color="var(--status-high)" /> Live Threat Feed
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="mitre-inline-tag">
              <Shield size={10} /> MITRE ATT&CK + FiGHT
            </span>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ThreatFeed api={api} socket={socket} onInvestigate={setSelectedAlert} />
        </div>
      </div>

      <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="glass-panel slide-in" style={{ padding: '1rem', animationDelay: '0.18s', flex: 1 }}>
          <h3 className="section-title" style={{ marginBottom: '0.5rem' }}>
            <Eye size={16} color="var(--status-suspicious)" /> Threat Activity Heatmap
          </h3>
          <ThreatHeatmap api={api} />
        </div>
        <div className="glass-panel slide-in" style={{ padding: '1rem', animationDelay: '0.2s', flex: 1 }}>
          <h3 className="section-title" style={{ marginBottom: '0.5rem' }}>
            <BarChart3 size={16} color="var(--accent-purple)" /> Severity Distribution
          </h3>
          <SeverityDistribution api={api} />
        </div>
      </div>

      {/* Row 4: Attackers + Protocol + Anomaly + Topology */}
      <div className="glass-panel slide-in" style={{ gridColumn: 'span 3', padding: '1rem', animationDelay: '0.22s' }}>
        <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>
          <Server size={16} color="var(--accent-purple)" /> Top Attackers
        </h3>
        <div style={{ height: '200px' }}>
          <TopAttackers api={api} />
        </div>
      </div>

      <div className="glass-panel slide-in" style={{ gridColumn: 'span 3', padding: '1rem', animationDelay: '0.24s' }}>
        <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>
          <Wifi size={16} color="var(--accent-blue)" /> Protocol Analysis
        </h3>
        <div style={{ height: '200px' }}>
          <ProtocolBreakdown api={api} />
        </div>
      </div>

      <div className="glass-panel slide-in" style={{ gridColumn: 'span 3', padding: '1rem', animationDelay: '0.26s' }}>
        <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>
          <Users size={16} color="var(--accent-cyan)" /> ML Confidence
        </h3>
        <div style={{ height: '200px' }}>
          <AnomalyChart api={api} />
        </div>
      </div>

      <div className="glass-panel slide-in" style={{ gridColumn: 'span 3', padding: '1rem', animationDelay: '0.28s' }}>
        <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>
          <Globe size={16} color="var(--accent-cyan)" /> Topology
        </h3>
        <div style={{ height: '200px' }}>
          <NetworkTopology api={api} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-container">
      <AlertInvestigation alert={selectedAlert} onClose={() => setSelectedAlert(null)} />

      {/* ── Navbar ── */}
      <header className="glass-panel dashboard-header" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 1.25rem', borderLeft: 'none', borderRight: 'none', borderTop: 'none',
        borderRadius: '0', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div className="flex-center" style={{ gap: '0.75rem' }}>
          <div className="flex-center" style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
            boxShadow: '0 0 12px var(--accent-cyan-glow)',
          }}>
            <Shield size={16} color="white" />
          </div>
          <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>SentinelMesh</h2>
          <span className="mono" style={{
            fontSize: '0.62rem', color: 'var(--text-muted)',
            padding: '0.12rem 0.5rem', background: 'var(--bg-tertiary)',
            borderRadius: '4px', border: '1px solid var(--border-color)',
          }}>
            SOC v3.0
          </span>
          {activeView === 'oran' && (
            <span className="mono" style={{
              fontSize: '0.58rem',
              padding: '0.12rem 0.45rem',
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: '4px',
              color: 'var(--accent-cyan)',
            }}>
              <Antenna size={10} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
              O-RAN SMO
            </span>
          )}
        </div>

        <div className="flex-center" style={{ gap: '1rem' }}>
          {/* WebSocket status */}
          <div className="flex-center" style={{ gap: '0.35rem' }}>
            <Wifi size={13} color={wsConnected ? 'var(--status-normal)' : 'var(--text-muted)'} />
            <span style={{ fontSize: '0.72rem', color: wsConnected ? 'var(--status-normal)' : 'var(--text-muted)', fontWeight: 500 }}>
              {wsConnected ? 'Live' : 'Polling'}
            </span>
          </div>

          <div className="flex-center" style={{ gap: '0.4rem' }}>
            <div className="status-dot-pulse"></div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Active</span>
          </div>

          {lastUpdated && (
            <div className="flex-center" style={{ gap: '0.3rem' }}>
              <Clock size={11} color="var(--text-muted)" />
              <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                {lastUpdated.toLocaleTimeString([], { hour12: false })}
              </span>
            </div>
          )}

          <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--border-color)' }}></div>

          <div className="flex-center" style={{ gap: '0.65rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: '500' }}>{user.name}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>SOC Analyst</div>
            </div>
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="Profile" style={{
                width: '32px', height: '32px', borderRadius: '50%',
                border: '2px solid var(--border-color)',
              }} />
            ) : (
              <div className="flex-center" style={{
                width: '32px', height: '32px', borderRadius: '50%',
                backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent-cyan)',
                fontWeight: '700', border: '2px solid var(--border-color)', fontSize: '0.85rem',
              }}>
                {user.login?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <button onClick={logout} className="logout-btn" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Layout ── */}
      <div className="dashboard-layout">
        <nav className="sidebar">
          <div className="sidebar-logo">
            <Shield size={18} />
          </div>

          {sidebarItems.map((item) => (
            <button
              key={item.id}
              className={`sidebar-btn ${activeView === item.id ? 'active' : ''}`}
              onClick={() => setActiveView(item.id)}
            >
              <item.icon size={18} />
              <span className="tooltip">{item.label}</span>
            </button>
          ))}

          <div className="sidebar-divider"></div>

          <button className="sidebar-btn" title="Notifications">
            <Bell size={18} />
            <span className="tooltip">Alerts</span>
          </button>
          <button className="sidebar-btn" title="Settings">
            <Settings size={18} />
            <span className="tooltip">Settings</span>
          </button>
        </nav>

        <main className="main-content">
          <StatsCards stats={stats} prevStats={prevStats} />

          <div style={{ marginTop: '1rem' }}>
            {renderContent()}
          </div>

          {/* Footer */}
          <div style={{
            marginTop: '1.5rem', paddingTop: '1rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingBottom: '1rem',
          }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              SentinelMesh Platform v3.0 — Enterprise SOC + O-RAN Security Dashboard
            </span>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              <span>MITRE ATT&CK + FiGHT</span>
              <span>|</span>
              <span>O-RAN WG11</span>
              <span>|</span>
              <span>WebSocket: {wsConnected ? 'Connected' : 'Disconnected'}</span>
              <span>|</span>
              <span>{stats.total_events.toLocaleString()} events</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
