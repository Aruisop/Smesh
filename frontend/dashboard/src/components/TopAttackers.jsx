import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
        <p style={{ margin: '0 0 0.5rem 0', fontWeight: '500', color: 'var(--text-primary)' }}>IP: {label}</p>
        <p style={{ margin: 0, color: 'var(--accent-purple)', fontSize: '0.9rem' }}>
          Threat Score: {payload[0].value.toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
};

export default function TopAttackers({ api }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/attackers?limit=8');
        setData(res.data.attackers);
      } catch (err) {
        console.error("Failed to fetch attackers", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [api]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border-color)" />
        <XAxis type="number" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} domain={[0, 'dataMax + 10']} />
        <YAxis dataKey="ip" type="category" stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
        <Bar dataKey="threat_score" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={'var(--accent-purple)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
