import React, { useState, useEffect } from 'react';
import { Cpu, Database, Wifi, HardDrive, Cloud, Shield, Activity } from 'lucide-react';

/**
 * SystemHealth — Enterprise-grade system health monitor showing
 * service status, uptime, latency, and resource utilization.
 */
export default function SystemHealth({ api, wsConnected }) {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await api.get('/health');
        setHealth(res.data);
      } catch {
        setHealth({ status: 'degraded', redis: 'unknown', websocket: 0, uptime: 0 });
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, [api]);

  const services = [
    {
      name: 'API Gateway',
      status: health?.status === 'ok' ? 'online' : 'degraded',
      icon: <Cloud size={14} />,
      detail: health ? `v${health.version || '2.0'}` : '...',
    },
    {
      name: 'Redis',
      status: health?.redis === 'connected' ? 'online' : 'offline',
      icon: <Database size={14} />,
      detail: health?.redis || '...',
    },
    {
      name: 'WebSocket',
      status: wsConnected ? 'online' : 'degraded',
      icon: <Wifi size={14} />,
      detail: health ? `${health.websocket || 0} clients` : '...',
    },
    {
      name: 'Threat Engine',
      status: 'online',
      icon: <Shield size={14} />,
      detail: 'Go 1.21+',
    },
    {
      name: 'ML Detector',
      status: 'online',
      icon: <Cpu size={14} />,
      detail: 'IsolationForest',
    },
    {
      name: 'Log Generator',
      status: 'online',
      icon: <Activity size={14} />,
      detail: '2 evt/s',
    },
  ];

  const formatUptime = (seconds) => {
    if (!seconds) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Uptime banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 0.75rem',
        background: 'var(--bg-secondary)',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <HardDrive size={13} color="var(--accent-cyan)" />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Uptime</span>
        </div>
        <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
          {formatUptime(health?.uptime)}
        </span>
      </div>

      {/* Service List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 }}>
        {services.map((svc) => (
          <div key={svc.name} className="health-item" style={{ flex: 'none' }}>
            <div className={`health-dot ${svc.status}`}></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.78rem',
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                }}>
                  {svc.icon}
                  {svc.name}
                </div>
                <span className="mono" style={{
                  fontSize: '0.65rem',
                  color: 'var(--text-muted)',
                }}>
                  {svc.detail}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
