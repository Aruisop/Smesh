import React, { useState, useEffect } from 'react';
import { Radio, Signal, AlertTriangle, CheckCircle, Zap, ArrowUpDown } from 'lucide-react';

/**
 * RANHealthMonitor — O1 Interface Performance Management Counter Display.
 * Shows gNB cell health KPIs including PRB utilization, handover success rate,
 * RRC setup failures, and throughput. Mimics real NOC RAN monitoring panels.
 */
export default function RANHealthMonitor({ api }) {
  const [cells, setCells] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/oran/telemetry');
        setCells(res.data.telemetry || []);
      } catch {
        setCells([]);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [api]);

  const getStatusColor = (status) => {
    return status === 'operational' ? 'var(--status-normal)' : 'var(--status-high)';
  };

  const getCellTypeIcon = (cellId) => {
    if (cellId.includes('DU')) return '◆';
    return '●';
  };

  const getKPIColor = (value, goodThreshold, badThreshold, invertScale = false) => {
    if (invertScale) {
      if (value <= goodThreshold) return 'var(--status-normal)';
      if (value <= badThreshold) return 'var(--status-suspicious)';
      return 'var(--status-high)';
    }
    if (value >= goodThreshold) return 'var(--status-normal)';
    if (value >= badThreshold) return 'var(--status-suspicious)';
    return 'var(--status-high)';
  };

  if (!cells.length) {
    return (
      <div className="flex-center" style={{ height: '100%', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        <Radio size={16} style={{ marginRight: '0.5rem' }} /> Waiting for O1 telemetry...
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Cell Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', flex: 1 }}>
        {cells.map((cell) => {
          const isSelected = selectedCell?.cell_id === cell.cell_id;
          const isDegraded = cell.status === 'degraded';
          return (
            <div
              key={cell.cell_id}
              onClick={() => setSelectedCell(isSelected ? null : cell)}
              style={{
                padding: '0.6rem',
                background: isSelected ? 'var(--bg-quaternary)' : 'var(--bg-secondary)',
                border: `1px solid ${isSelected ? 'var(--accent-cyan)' : isDegraded ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {isDegraded && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                  background: 'var(--status-high)',
                  animation: 'badgePulse 1.5s ease-in-out infinite',
                }}></div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ color: getStatusColor(cell.status), fontSize: '0.6rem' }}>
                    {getCellTypeIcon(cell.cell_id)}
                  </span>
                  <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {cell.cell_id.replace('gNB-', '')}
                  </span>
                </div>
                <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
                  {cell.band}
                </span>
              </div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                {cell.cell_name}
              </div>
              {/* Mini KPIs */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.25rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div className="mono" style={{
                    fontSize: '0.7rem', fontWeight: 700,
                    color: getKPIColor(cell.prb_utilization, 80, 90, true),
                  }}>
                    {Math.round(cell.prb_utilization)}%
                  </div>
                  <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>PRB</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="mono" style={{
                    fontSize: '0.7rem', fontWeight: 700,
                    color: getKPIColor(cell.rrc_setup_success_rate, 95, 80),
                  }}>
                    {Math.round(cell.rrc_setup_success_rate)}%
                  </div>
                  <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>RRC</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="mono" style={{
                    fontSize: '0.7rem', fontWeight: 700,
                    color: 'var(--accent-cyan)',
                  }}>
                    {cell.active_ues}
                  </div>
                  <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>UEs</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Cell Detail */}
      {selectedCell && (
        <div style={{
          padding: '0.75rem',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--accent-cyan)',
          borderRadius: '8px',
          animation: 'slideInUp 0.2s ease-out',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Signal size={14} color="var(--accent-cyan)" />
              <span className="mono" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                {selectedCell.cell_id}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {selectedCell.location}
              </span>
            </div>
            <span className={`badge ${selectedCell.status === 'operational' ? 'badge-normal' : 'badge-high'}`}>
              {selectedCell.status.toUpperCase()}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem' }}>
            {[
              { label: 'DL Throughput', value: `${selectedCell.throughput_dl_mbps} Mbps`, color: getKPIColor(selectedCell.throughput_dl_mbps, 100, 30) },
              { label: 'UL Throughput', value: `${selectedCell.throughput_ul_mbps} Mbps`, color: getKPIColor(selectedCell.throughput_ul_mbps, 50, 15) },
              { label: 'Latency', value: `${selectedCell.latency_avg_ms} ms`, color: getKPIColor(selectedCell.latency_avg_ms, 5, 20, true) },
              { label: 'HO Success', value: `${selectedCell.handover_success_rate}%`, color: getKPIColor(selectedCell.handover_success_rate, 90, 70) },
              { label: 'RSRP', value: `${selectedCell.rsrp_avg_dbm} dBm`, color: getKPIColor(selectedCell.rsrp_avg_dbm, -80, -100) },
              { label: 'SINR', value: `${selectedCell.sinr_avg_db} dB`, color: getKPIColor(selectedCell.sinr_avg_db, 15, 5) },
            ].map((kpi) => (
              <div key={kpi.label} style={{ textAlign: 'center' }}>
                <div className="mono" style={{ fontSize: '0.78rem', fontWeight: 600, color: kpi.color }}>
                  {kpi.value}
                </div>
                <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {kpi.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
