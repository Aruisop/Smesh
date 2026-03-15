import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: 'var(--bg-tertiary)',
        border: '1px solid var(--border-color)',
        padding: '1rem',
        borderRadius: '8px',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <p style={{ margin: '0 0 0.5rem 0', fontWeight: '500', color: 'var(--text-primary)' }}>{label}</p>
        <p style={{ margin: 0, color: 'var(--accent-blue)', fontSize: '0.9rem' }}>
          Total Events: {payload[0].value}
        </p>
        <p style={{ margin: '0.25rem 0 0 0', color: 'var(--status-high)', fontSize: '0.9rem' }}>
          Anomalous: {payload[1].value}
        </p>
        <p style={{ margin: '0.25rem 0 0 0', color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>
          Avg ML Score: {payload[2].value}
        </p>
      </div>
    );
  }
  return null;
};

export default function TrafficTimeline({ api }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/anomalies');
        // Convert 'YYYY-MM-DDTHH:mm' to just 'HH:mm'
        const formattedData = res.data.anomalies.map(d => ({
          ...d,
          timeLabel: d.time.split('T')[1] || d.time
        }));
        setData(formattedData);
      } catch (err) {
        console.error("Failed to fetch timeline", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [api]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorAnomalous" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--status-high)" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="var(--status-high)" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
        <XAxis dataKey="timeLabel" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
        <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="count" name="Total Events" stroke="var(--accent-blue)" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
        <Area type="monotone" dataKey="anomalous" name="Anomalies" stroke="var(--status-high)" fillOpacity={1} fill="url(#colorAnomalous)" strokeWidth={2} />
        {/* Hidden area just to pass the avg score to the tooltip without graphing it */}
        <Area type="monotone" dataKey="avgScore" name="Avg Score" stroke="none" fill="none" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
