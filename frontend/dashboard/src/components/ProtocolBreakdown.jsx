import React, { useState, useEffect, useMemo } from 'react';

/**
 * ProtocolBreakdown — Displays protocol distribution and port analysis
 * as a horizontal stacked bar with detail breakdown.
 */
export default function ProtocolBreakdown({ api }) {
  const [traffic, setTraffic] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/traffic?limit=200');
        setTraffic(res.data.traffic || []);
      } catch {
        setTraffic([]);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [api]);

  const breakdown = useMemo(() => {
    const protocols = {};
    const ports = {};
    traffic.forEach((t) => {
      const proto = t.protocol || 'UNKNOWN';
      protocols[proto] = (protocols[proto] || 0) + 1;
      const port = t.dst_port || 'N/A';
      ports[port] = (ports[port] || 0) + 1;
    });

    const total = traffic.length || 1;
    const protoList = Object.entries(protocols)
      .map(([name, count]) => ({ name, count, pct: (count / total * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count);

    const portList = Object.entries(ports)
      .map(([port, count]) => ({ port, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return { protoList, portList, total };
  }, [traffic]);

  const protoColors = {
    TCP: '#3B82F6',
    UDP: '#8B5CF6',
    ICMP: '#F59E0B',
    DNS: '#06B6D4',
    UNKNOWN: '#64748B',
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center' }}>
      {/* Stacked bar */}
      <div style={{ display: 'flex', height: '18px', borderRadius: '4px', overflow: 'hidden', gap: '1px' }}>
        {breakdown.protoList.map((p) => (
          <div
            key={p.name}
            style={{
              flex: p.count,
              background: protoColors[p.name] || '#64748B',
              opacity: 0.8,
              transition: 'flex 0.5s ease',
              position: 'relative',
            }}
            title={`${p.name}: ${p.count} (${p.pct}%)`}
          />
        ))}
      </div>

      {/* Protocol legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
        {breakdown.protoList.map((p) => (
          <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: protoColors[p.name] || '#64748B' }}></div>
            <span className="mono" style={{ color: 'var(--text-secondary)' }}>{p.name}</span>
            <span className="mono" style={{ color: 'var(--text-muted)' }}>{p.pct}%</span>
          </div>
        ))}
      </div>

      {/* Top ports */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Top Target Ports
        </div>
        {breakdown.portList.map((p) => {
          const pct = (p.count / breakdown.total) * 100;
          const portNames = { 22: 'SSH', 53: 'DNS', 80: 'HTTP', 443: 'HTTPS', 3306: 'MySQL', 3389: 'RDP', 5432: 'PgSQL', 8080: 'Alt-HTTP' };
          return (
            <div key={p.port} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', width: '28px', textAlign: 'right' }}>
                {p.port}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', width: '40px' }}>
                {portNames[p.port] || ''}
              </span>
              <div style={{ flex: 1, height: '5px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(pct * 2, 100)}%`,
                  height: '100%',
                  background: 'var(--accent-cyan)',
                  borderRadius: '3px',
                  opacity: 0.7,
                  transition: 'width 0.4s ease',
                }}></div>
              </div>
              <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                {p.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
