import React, { useEffect, useRef, useState } from 'react';
import { Activity, ShieldAlert, Users, RadioTower, TrendingUp, TrendingDown } from 'lucide-react';

/**
 * AnimatedCounter — Smoothly animates numbers using requestAnimationFrame.
 */
const AnimatedCounter = ({ value, duration = 800 }) => {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);
  const animFrame = useRef(null);

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = Math.round(start + (end - start) * eased);
      setDisplay(current);
      if (progress < 1) {
        animFrame.current = requestAnimationFrame(animate);
      } else {
        prevValue.current = end;
      }
    };

    animFrame.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame.current);
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
};

const StatCard = ({ title, value, icon, colorClass, delay, prevValue }) => {
  const delta = prevValue ? value - prevValue : 0;
  const deltaPercent = prevValue && prevValue > 0 ? ((delta / prevValue) * 100).toFixed(1) : null;

  return (
    <div className={`glass-panel stat-card slide-up ${colorClass}`} style={{ animationDelay: delay }}>
      <div className="flex-between">
        <span className="stat-label">{title}</span>
        <div className="stat-icon" style={{ background: `rgba(${icon.rgb}, 0.1)` }}>
          {icon.element}
        </div>
      </div>
      <div className="stat-value" style={{ color: icon.textColor || 'var(--text-primary)' }}>
        <AnimatedCounter value={value} />
      </div>
      {deltaPercent && Math.abs(delta) > 0 && (
        <span
          className="stat-delta"
          style={{
            background: delta > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            color: delta > 0 ? 'var(--status-high)' : 'var(--status-normal)',
          }}
        >
          {delta > 0 ? <TrendingUp size={10} style={{ marginRight: 3 }} /> : <TrendingDown size={10} style={{ marginRight: 3 }} />}
          {delta > 0 ? '+' : ''}{deltaPercent}%
        </span>
      )}
    </div>
  );
};

export default function StatsCards({ stats, prevStats }) {
  return (
    <div className="stats-grid">
      <StatCard
        title="Events Processed"
        value={stats.total_events}
        prevValue={prevStats?.total_events}
        icon={{ element: <Activity size={18} color="var(--accent-blue)" />, rgb: '59,130,246' }}
        colorClass="blue"
        delay="0s"
      />
      <StatCard
        title="Anomalies Detected"
        value={stats.total_alerts}
        prevValue={prevStats?.total_alerts}
        icon={{ element: <RadioTower size={18} color="var(--status-suspicious)" />, rgb: '245,158,11' }}
        colorClass="yellow"
        delay="0.05s"
      />
      <StatCard
        title="Critical Threats"
        value={stats.high_threats}
        prevValue={prevStats?.high_threats}
        icon={{ element: <ShieldAlert size={18} color="var(--status-high)" />, rgb: '239,68,68', textColor: stats.high_threats > 0 ? 'var(--status-high)' : undefined }}
        colorClass="red"
        delay="0.1s"
      />
      <StatCard
        title="Active Attackers"
        value={stats.active_attackers}
        prevValue={prevStats?.active_attackers}
        icon={{ element: <Users size={18} color="var(--accent-purple)" />, rgb: '139,92,246' }}
        colorClass="purple"
        delay="0.15s"
      />
    </div>
  );
}
