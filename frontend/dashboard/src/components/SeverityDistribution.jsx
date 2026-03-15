import React, { useState, useEffect, useMemo } from 'react';

/**
 * SeverityDistribution — Donut chart visualization for alert severity breakdown.
 * Uses pure SVG with smooth animations.
 */
export default function SeverityDistribution({ api }) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await api.get('/alerts?limit=200');
        setAlerts(res.data.alerts || []);
      } catch {
        setAlerts([]);
      }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 8000);
    return () => clearInterval(interval);
  }, [api]);

  const distribution = useMemo(() => {
    const counts = { HIGH: 0, MEDIUM: 0, SUSPICIOUS: 0, NORMAL: 0 };
    alerts.forEach((a) => { counts[a.severity] = (counts[a.severity] || 0) + 1; });
    const total = Object.values(counts).reduce((s, c) => s + c, 0) || 1;
    return { counts, total };
  }, [alerts]);

  const severities = [
    { key: 'HIGH', label: 'Critical', color: '#EF4444' },
    { key: 'MEDIUM', label: 'Medium', color: '#F97316' },
    { key: 'SUSPICIOUS', label: 'Suspicious', color: '#F59E0B' },
    { key: 'NORMAL', label: 'Normal', color: '#10B981' },
  ];

  // SVG Donut calculations
  const size = 120;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;
  const segments = severities.map((sev) => {
    const count = distribution.counts[sev.key] || 0;
    const percentage = count / distribution.total;
    const dashLength = percentage * circumference;
    const dashOffset = circumference - cumulativeOffset;
    cumulativeOffset += dashLength;
    return { ...sev, count, percentage, dashLength, dashOffset };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: '100%', gap: '1rem' }}>
      {/* Donut Chart */}
      <div className="severity-ring">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--bg-secondary)"
            strokeWidth={strokeWidth}
          />
          {/* Data segments */}
          {segments.map((seg, i) => (
            <circle
              key={seg.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth - 1}
              strokeDasharray={`${seg.dashLength} ${circumference - seg.dashLength}`}
              strokeDashoffset={seg.dashOffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: 'stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease' }}
              opacity={0.85}
            />
          ))}
        </svg>
        <div className="severity-ring-label">
          <span className="mono" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {distribution.total}
          </span>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Total
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="severity-legend">
        {segments.map((seg) => (
          <div key={seg.key} className="severity-legend-item">
            <div className="severity-legend-dot" style={{ background: seg.color }}></div>
            <span style={{ color: 'var(--text-secondary)', flex: 1, minWidth: '60px' }}>{seg.label}</span>
            <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
              {seg.count}
            </span>
            <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginLeft: '0.25rem' }}>
              ({(seg.percentage * 100).toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
