import React from 'react';
import {
  X, Shield, Globe, Cpu, AlertTriangle, ExternalLink, Antenna, Radio,
  Lock, Zap, Network, Server, ChevronRight
} from 'lucide-react';

/**
 * AlertInvestigation — Detailed flyout panel for deep alert analysis.
 * Shows MITRE ATT&CK / FiGHT classification, network details,
 * ML analysis, O-RAN context, and recommended mitigations.
 */
export default function AlertInvestigation({ alert, onClose }) {
  if (!alert) return null;

  const mitre = alert.mitre || {};
  const hasMitre = mitre.technique && mitre.technique !== 'N/A';
  const isTelecom = alert.domain === 'telecom' ||
    ['rogue_basestation', 'handover_hijack', 'signaling_storm',
     'unauthorized_slice_access', 'imsi_catcher'].includes(alert.event_type);
  const ranCtx = alert.ran_context || {};

  const severityColor = {
    HIGH: 'var(--status-high)',
    MEDIUM: 'var(--status-medium)',
    SUSPICIOUS: 'var(--status-suspicious)',
    NORMAL: 'var(--status-normal)',
  }[alert.severity] || 'var(--text-muted)';

  const severityBg = {
    HIGH: 'var(--status-high-bg)',
    MEDIUM: 'var(--status-medium-bg)',
    SUSPICIOUS: 'var(--status-suspicious-bg)',
    NORMAL: 'var(--status-normal-bg)',
  }[alert.severity] || 'transparent';

  return (
    <div className="investigation-overlay" onClick={onClose}>
      <div
        className="glass-panel investigation-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-secondary)' }}
      >
        {/* Header */}
        <div className="investigation-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              padding: '0.35rem', borderRadius: '8px',
              background: isTelecom ? 'rgba(6, 182, 212, 0.1)' : severityBg,
              color: isTelecom ? 'var(--accent-cyan)' : severityColor,
            }}>
              {isTelecom ? <Antenna size={18} /> : <Shield size={18} />}
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 700 }}>
                Alert Investigation
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {alert.id}
                </span>
                {isTelecom && (
                  <span style={{
                    fontSize: '0.55rem', padding: '0.05rem 0.3rem',
                    background: 'rgba(6, 182, 212, 0.1)',
                    border: '1px solid rgba(6, 182, 212, 0.25)',
                    borderRadius: '3px', color: 'var(--accent-cyan)',
                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                  }}>
                    O-RAN DOMAIN
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className="investigation-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="investigation-body">
          {/* Severity Banner */}
          <div className="investigation-severity-banner" style={{
            background: severityBg,
            border: `1px solid ${severityColor}30`,
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>
                Alert Type
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: severityColor }}>
                {alert.alert_type}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>
                Severity
              </div>
              <span className={`badge badge-${alert.severity === 'HIGH' ? 'high' : alert.severity === 'MEDIUM' ? 'medium' : 'suspicious'}`}
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}>
                {alert.severity}
              </span>
            </div>
          </div>

          {/* Description */}
          <div style={{
            padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: '8px',
            border: '1px solid var(--border-color)', marginBottom: '1.25rem',
            fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5,
          }}>
            {alert.description}
          </div>

          {/* ─── Network Details ─── */}
          <div className="investigation-section">
            <h4 className="investigation-section-title">
              <Globe size={15} color="var(--accent-blue)" /> Network Context
            </h4>
            <div className="investigation-grid">
              <Field label="Source IP" value={alert.src_ip} />
              <Field label="Destination IP" value={alert.dst_ip} />
              <Field label="Protocol" value={alert.protocol} />
              <Field label="Dest Port" value={alert.dst_port} />
              <Field label="Event Type" value={alert.event_type} mono />
              <Field label="Timestamp" value={new Date(alert.timestamp).toLocaleString()} />
            </div>
          </div>

          {/* ─── O-RAN Context (telecom events only) ─── */}
          {isTelecom && (
            <div className="investigation-section">
              <h4 className="investigation-section-title">
                <Antenna size={15} color="var(--accent-cyan)" /> O-RAN Context
              </h4>
              {alert.cell_id && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div className="investigation-label">Target Cell</div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.4rem 0.6rem', background: 'var(--bg-primary)',
                    borderRadius: '6px', border: '1px solid var(--border-color)',
                  }}>
                    <Radio size={13} color="var(--accent-cyan)" />
                    <span className="mono" style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>
                      {alert.cell_id}
                    </span>
                  </div>
                </div>
              )}
              <div className="investigation-grid">
                {ranCtx.spoofed_cell && <Field label="Spoofed Cell" value={ranCtx.spoofed_cell} />}
                {ranCtx.signal_strength && <Field label="Rogue RSRP" value={`${ranCtx.signal_strength} dBm`} />}
                {ranCtx.legitimate_rsrp && <Field label="Legit RSRP" value={`${ranCtx.legitimate_rsrp} dBm`} />}
                {ranCtx.source_cell && <Field label="Source Cell" value={ranCtx.source_cell} />}
                {ranCtx.target_cell && <Field label="Target Cell" value={ranCtx.target_cell} />}
                {ranCtx.handover_cause && <Field label="HO Cause" value={ranCtx.handover_cause} />}
                {ranCtx.affected_ues && <Field label="Affected UEs" value={ranCtx.affected_ues} />}
                {ranCtx.msg_type && <Field label="Message Type" value={ranCtx.msg_type} mono />}
                {ranCtx.rate_per_sec && <Field label="Rate" value={`${ranCtx.rate_per_sec} msg/s`} />}
                {ranCtx.target_slice && <Field label="Target Slice" value={ranCtx.target_slice} mono />}
                {ranCtx.slice_type && <Field label="Slice Type" value={ranCtx.slice_type} />}
                {ranCtx.identity_requests && <Field label="ID Requests" value={ranCtx.identity_requests} />}
                {ranCtx.downgrade_attempt !== undefined && (
                  <Field label="5G→4G Downgrade" value={ranCtx.downgrade_attempt ? 'YES ⚠' : 'No'} />
                )}
              </div>
            </div>
          )}

          {/* ─── ML Analysis ─── */}
          <div className="investigation-section">
            <h4 className="investigation-section-title">
              <Cpu size={15} color="var(--accent-purple)" /> ML Analysis
            </h4>
            <div className="investigation-grid">
              <Field label="Anomaly Score" value={alert.anomaly_score?.toFixed(4)} />
              <Field label="Threat Score" value={alert.threat_score?.toFixed(4)} />
              <Field label="Failed Auth" value={alert.failed_attempts || 0} />
              <Field label="Domain" value={isTelecom ? 'Telecom' : 'Network'} />
            </div>
            {/* Score visualization */}
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.25rem',
              }}>
                <span>Threat Score</span>
                <span className="mono">{(alert.threat_score * 100).toFixed(1)}%</span>
              </div>
              <div style={{
                width: '100%', height: '6px', background: 'var(--bg-primary)',
                borderRadius: '3px', overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.min(alert.threat_score * 100, 100)}%`, height: '100%',
                  background: `linear-gradient(90deg, var(--status-suspicious), ${severityColor})`,
                  borderRadius: '3px', transition: 'width 0.4s ease',
                }}></div>
              </div>
            </div>
          </div>

          {/* ─── MITRE ATT&CK / FiGHT ─── */}
          {hasMitre && (
            <div className="investigation-section">
              <h4 className="investigation-section-title">
                <Shield size={15} color={isTelecom ? 'var(--accent-cyan)' : 'var(--mitre-tactic)'} />
                {isTelecom ? 'MITRE FiGHT Classification' : 'MITRE ATT&CK Classification'}
              </h4>

              <div className="mitre-chain">
                <div className="mitre-chain-item">
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tactic</span>
                  <span className="mitre-tag mitre-tactic">{mitre.tactic}</span>
                </div>
                <ChevronRight size={14} color="var(--text-muted)" />
                <div className="mitre-chain-item">
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Technique</span>
                  <span className="mitre-tag mitre-technique">{mitre.technique} — {mitre.techniqueName}</span>
                </div>
                {mitre.subtechnique && (
                  <>
                    <ChevronRight size={14} color="var(--text-muted)" />
                    <div className="mitre-chain-item">
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sub-technique</span>
                      <span className="mitre-tag mitre-sub">{mitre.subtechnique} — {mitre.subtechniqueName}</span>
                    </div>
                  </>
                )}
              </div>

              {/* O-RAN Reference */}
              {mitre.oranRef && (
                <div style={{
                  marginTop: '0.75rem', padding: '0.4rem 0.6rem',
                  background: 'rgba(6, 182, 212, 0.05)',
                  border: '1px solid rgba(6, 182, 212, 0.15)',
                  borderRadius: '6px', fontSize: '0.72rem',
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>Reference: </span>
                  <span className="mono" style={{ color: 'var(--accent-cyan)', fontWeight: 500 }}>
                    {mitre.oranRef}
                  </span>
                </div>
              )}

              {/* Mitigations */}
              {mitre.mitigations?.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div className="investigation-label" style={{ marginBottom: '0.4rem' }}>
                    <Lock size={11} /> Recommended Mitigations
                  </div>
                  {mitre.mitigations.map((m, i) => (
                    <div key={i} className="mitigation-item">
                      <Zap size={11} color={isTelecom ? 'var(--accent-cyan)' : 'var(--accent-emerald)'} />
                      <span style={{ color: 'var(--text-secondary)' }}>{m}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* MITRE Reference Link */}
              <a
                href={isTelecom
                  ? 'https://fight.mitre.org/'
                  : `https://attack.mitre.org/techniques/${mitre.technique?.replace('.', '/')}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="mitre-link"
                style={isTelecom ? {
                  color: 'var(--accent-cyan)',
                  borderColor: 'rgba(6, 182, 212, 0.2)',
                } : {}}
              >
                <ExternalLink size={13} />
                {isTelecom ? 'View on MITRE FiGHT →' : 'View on MITRE ATT&CK →'}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Reusable field component
function Field({ label, value, mono }) {
  return (
    <div className="investigation-field">
      <span className="investigation-label">{label}</span>
      <span className={mono ? 'mono' : ''} style={{
        fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500,
      }}>
        {value}
      </span>
    </div>
  );
}
