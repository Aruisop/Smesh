import React, { useState, useEffect } from 'react';

export default function AnomalyChart({ api }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnomalies = async () => {
      try {
        const res = await api.get('/anomalies');
        // Expected format: [{ bucket: '0.9-1.0', count: 42 }, ...]
        setData(res.data?.anomalies || []);
      } catch (err) {
        console.error("Failed to fetch anomaly distribution", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnomalies();
    const interval = setInterval(fetchAnomalies, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [api]);

  if (loading) return <div className="flex-center" style={{ height: '100%', color: 'var(--text-muted)' }}>Loading model data...</div>;
  if (!data.length) return <div className="flex-center" style={{ height: '100%', color: 'var(--text-muted)' }}>No high confidence anomalies detected.</div>;

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', gap: '8px', padding: '10px 0' }}>
      {data.map((item, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{item.count}</div>
          <div 
            style={{ 
              width: '100%', 
              height: `${(item.count / maxCount) * 100}px`,
              backgroundColor: i > data.length - 3 ? 'var(--status-high)' : 'var(--accent-purple)',
              borderRadius: '4px 4px 0 0',
              opacity: 0.8,
              transition: 'height 0.3s ease'
            }}
          ></div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{item.time?.split('T')[1]?.substring(0,5) || item.time?.substring(11, 16) || item.time}</div>
        </div>
      ))}
    </div>
  );
}
