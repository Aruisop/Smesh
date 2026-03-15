import React, { useState, useEffect, useMemo } from 'react';

/**
 * ThreatHeatmap — Time-based heatmap visualization showing threat
 * intensity across hours and days. Enterprise SOC style.
 */
export default function ThreatHeatmap({ api }) {
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
    const interval = setInterval(fetchAlerts, 12000);
    return () => clearInterval(interval);
  }, [api]);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Build heatmap data from alerts
  const heatmapData = useMemo(() => {
    const grid = {};
    days.forEach((d) => {
      grid[d] = {};
      hours.forEach((h) => { grid[d][h] = 0; });
    });

    alerts.forEach((alert) => {
      try {
        const date = new Date(alert.timestamp);
        const dayIdx = date.getDay(); // 0=Sun
        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIdx];
        const hour = date.getHours();
        if (grid[dayName]) {
          grid[dayName][hour] = (grid[dayName][hour] || 0) + 1;
        }
      } catch {}
    });

    return grid;
  }, [alerts]);

  const maxValue = useMemo(() => {
    let max = 1;
    Object.values(heatmapData).forEach((row) => {
      Object.values(row).forEach((val) => { max = Math.max(max, val); });
    });
    return max;
  }, [heatmapData]);

  const getColor = (value) => {
    if (value === 0) return 'rgba(255, 255, 255, 0.02)';
    const intensity = value / maxValue;
    if (intensity > 0.75) return 'rgba(239, 68, 68, 0.8)';
    if (intensity > 0.5) return 'rgba(249, 115, 22, 0.7)';
    if (intensity > 0.25) return 'rgba(245, 158, 11, 0.5)';
    return 'rgba(6, 182, 212, 0.3)';
  };

  const [hoveredCell, setHoveredCell] = useState(null);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flex: 1, gap: '2px' }}>
        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginRight: '4px', paddingTop: '18px' }}>
          {days.map((d) => (
            <div
              key={d}
              style={{
                height: '14px',
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.6rem',
                color: 'var(--text-muted)',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {/* Hour labels */}
          <div style={{ display: 'flex', gap: '2px' }}>
            {hours.filter((_, i) => i % 3 === 0).map((h) => (
              <div
                key={h}
                style={{
                  flex: 3,
                  fontSize: '0.55rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'JetBrains Mono, monospace',
                  textAlign: 'left',
                }}
              >
                {String(h).padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* Cells */}
          {days.map((day) => (
            <div key={day} style={{ display: 'flex', gap: '2px' }}>
              {hours.map((hour) => {
                const value = heatmapData[day]?.[hour] || 0;
                const isHovered = hoveredCell?.day === day && hoveredCell?.hour === hour;
                return (
                  <div
                    key={`${day}-${hour}`}
                    className="heatmap-cell"
                    onMouseEnter={() => setHoveredCell({ day, hour, value })}
                    onMouseLeave={() => setHoveredCell(null)}
                    style={{
                      flex: 1,
                      height: '14px',
                      background: getColor(value),
                      border: isHovered ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
                    }}
                    title={`${day} ${String(hour).padStart(2, '0')}:00 — ${value} alerts`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '0.5rem',
        paddingTop: '0.4rem',
      }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          {hoveredCell
            ? `${hoveredCell.day} ${String(hoveredCell.hour).padStart(2, '0')}:00 — ${hoveredCell.value} alerts`
            : 'Hover to inspect'
          }
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>Low</span>
          {[0.1, 0.3, 0.5, 0.75, 1].map((i) => (
            <div key={i} style={{
              width: '10px',
              height: '8px',
              borderRadius: '2px',
              background: getColor(i * maxValue),
            }}></div>
          ))}
          <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>High</span>
        </div>
      </div>
    </div>
  );
}
