import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Info, AlertTriangle, AlertCircle, Zap, Shield, Antenna, Radio } from 'lucide-react';

/**
 * ThreatFeed — Real-time threat alert list with Socket.IO push updates,
 * MITRE ATT&CK + FiGHT classification, and click-to-investigate.
 * Supports both network and O-RAN telecom domain alerts.
 */
export default function ThreatFeed({ api, socket, onInvestigate }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newAlertFlash, setNewAlertFlash] = useState(null);
  const feedRef = useRef(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await api.get('/alerts?limit=30');
        setAlerts(res.data.alerts);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch alerts", err);
        setLoading(false);
      }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, [api]);

  useEffect(() => {
    if (!socket) return;
    const handleNewThreat = (alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 50));
      setNewAlertFlash(alert.id);
      setTimeout(() => setNewAlertFlash(null), 2000);
    };
    socket.on('threat:new', handleNewThreat);
    return () => socket.off('threat:new', handleNewThreat);
  }, [socket]);

  const getSeverityConfig = (severity) => {
    switch (severity) {
      case 'HIGH':
        return { color: 'var(--status-high)', bg: 'var(--status-high-bg)', icon: <ShieldAlert size={15} /> };
      case 'MEDIUM':
        return { color: 'var(--status-medium)', bg: 'var(--status-medium-bg)', icon: <AlertTriangle size={15} /> };
      case 'SUSPICIOUS':
        return { color: 'var(--status-suspicious)', bg: 'var(--status-suspicious-bg)', icon: <AlertCircle size={15} /> };
      default:
        return { color: 'var(--status-normal)', bg: 'var(--status-normal-bg)', icon: <Info size={15} /> };
    }
  };

  const isTelecomEvent = (eventType) => {
    return ['rogue_basestation', 'handover_hijack', 'signaling_storm',
            'unauthorized_slice_access', 'imsi_catcher'].includes(eventType);
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '100%' }}>
        <div className="app-loader-ring"></div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="flex-center" style={{ height: '100%', flexDirection: 'column', color: 'var(--text-muted)' }}>
        <ShieldAlert size={28} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
        <p style={{ fontSize: '0.82rem' }}>No active threats detected.</p>
      </div>
    );
  }

  return (
    <div ref={feedRef} style={{ height: '100%', overflowY: 'auto', paddingRight: '0.25rem' }}>
      {alerts.map((alert, idx) => {
        const config = getSeverityConfig(alert.severity);
        const time = new Date(alert.timestamp).toLocaleTimeString([], { hour12: false });
        const isNew = newAlertFlash === alert.id;
        const hasMitre = alert.mitre && alert.mitre.technique && alert.mitre.technique !== 'N/A';
        const isTelecom = isTelecomEvent(alert.event_type) || alert.domain === 'telecom';

        return (
          <div
            key={`${alert.id}-${idx}`}
            className={`threat-feed-item ${isNew ? 'threat-feed-item-new' : ''}`}
            onClick={() => onInvestigate?.(alert)}
            style={{ cursor: onInvestigate ? 'pointer' : 'default' }}
          >
            {/* Severity icon */}
            <div className="threat-feed-icon" style={{
              backgroundColor: config.bg, color: config.color,
              position: 'relative',
            }}>
              {isTelecom ? <Antenna size={15} /> : config.icon}
              {/* Telecom domain dot */}
              {isTelecom && (
                <div style={{
                  position: 'absolute', top: -2, right: -2,
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--accent-cyan)',
                  border: '1.5px solid var(--bg-primary)',
                }}></div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Title row */}
              <div className="flex-between" style={{ marginBottom: '0.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                  <h4 style={{
                    fontSize: '0.82rem', margin: 0, color: 'var(--text-primary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {alert.alert_type}
                  </h4>
                  {isTelecom && (
                    <span style={{
                      fontSize: '0.55rem',
                      padding: '0.08rem 0.3rem',
                      background: 'rgba(6, 182, 212, 0.1)',
                      border: '1px solid rgba(6, 182, 212, 0.25)',
                      borderRadius: '3px',
                      color: 'var(--accent-cyan)',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 600,
                      flexShrink: 0,
                    }}>
                      O-RAN
                    </span>
                  )}
                </div>
                <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {time}
                </span>
              </div>

              {/* Description */}
              <p style={{
                fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.35rem 0',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {alert.description}
              </p>

              {/* Meta row */}
              <div style={{
                display: 'flex', gap: '0.5rem', fontSize: '0.65rem',
                fontFamily: "'JetBrains Mono', monospace", flexWrap: 'wrap', alignItems: 'center',
              }}>
                <span style={{ color: 'var(--accent-blue)' }}>{alert.src_ip}</span>
                <span style={{ color: 'var(--text-muted)' }}>→</span>
                <span style={{ color: 'var(--accent-cyan)' }}>:{alert.dst_port}</span>
                <span style={{ color: config.color, fontWeight: 600 }}>
                  {alert.threat_score?.toFixed(3)}
                </span>

                {/* Cell ID for telecom events */}
                {alert.cell_id && (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>|</span>
                    <span style={{ color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <Radio size={9} /> {alert.cell_id}
                    </span>
                  </>
                )}

                {/* MITRE tag */}
                {hasMitre && (
                  <span className="mitre-inline-tag" style={
                    isTelecom ? {
                      background: 'rgba(6, 182, 212, 0.1)',
                      borderColor: 'rgba(6, 182, 212, 0.25)',
                      color: 'var(--accent-cyan)',
                    } : {}
                  }>
                    <Shield size={8} />
                    {alert.mitre.technique}
                  </span>
                )}
              </div>
            </div>

            {onInvestigate && (
              <div className="threat-feed-arrow">
                <Zap size={13} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
