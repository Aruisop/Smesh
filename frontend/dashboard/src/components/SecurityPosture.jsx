import React, { useState, useEffect, useMemo } from 'react';
import { Shield, TrendingUp, TrendingDown, AlertTriangle, Lock } from 'lucide-react';

/**
 * SecurityPosture — O-RAN Security Posture Score.
 * Displays aggregated security health as a radial gauge with
 * 3GPP/O-RAN compliance area breakdown.
 */
export default function SecurityPosture({ api }) {
  const [posture, setPosture] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/oran/posture');
        setPosture(res.data);
      } catch {
        setPosture(null);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [api]);

  if (!posture) {
    return (
      <div className="flex-center" style={{ height: '100%', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        <Lock size={14} style={{ marginRight: '0.5rem' }} /> Computing posture...
      </div>
    );
  }

  const score = posture.posture_score;
  const scoreColor = score >= 80 ? 'var(--status-normal)' : score >= 50 ? 'var(--status-suspicious)' : 'var(--status-high)';

  // SVG Arc gauge
  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // half circle
  const progress = (score / 100) * circumference;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Gauge + Score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ position: 'relative', width: size, height: size / 2 + 15 }}>
          <svg width={size} height={size / 2 + 15} viewBox={`0 0 ${size} ${size / 2 + 15}`}>
            {/* Background arc */}
            <path
              d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
              fill="none"
              stroke="var(--bg-tertiary)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {/* Score arc */}
            <path
              d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
              fill="none"
              stroke={scoreColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${progress} ${circumference}`}
              style={{ transition: 'stroke-dasharray 0.8s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute',
            bottom: '0',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
          }}>
            <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
              {Math.round(score)}
            </div>
            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Posture
            </div>
          </div>
        </div>

        {/* Risk Level + Summary */}
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.7rem',
            fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            background: score >= 80 ? 'var(--status-normal-bg)' : score >= 50 ? 'var(--status-suspicious-bg)' : 'var(--status-high-bg)',
            color: scoreColor,
            marginBottom: '0.4rem',
          }}>
            <Shield size={11} />
            {posture.risk_level} RISK
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem 0.75rem', fontSize: '0.65rem' }}>
            <div style={{ color: 'var(--text-muted)' }}>Telecom Threats:</div>
            <div className="mono" style={{ color: posture.summary?.telecom_threats > 0 ? 'var(--status-high)' : 'var(--text-primary)', fontWeight: 600 }}>
              {posture.summary?.telecom_threats || 0}
            </div>
            <div style={{ color: 'var(--text-muted)' }}>Policies at Risk:</div>
            <div className="mono" style={{ color: posture.summary?.policies_at_risk > 0 ? 'var(--status-suspicious)' : 'var(--text-primary)', fontWeight: 600 }}>
              {posture.summary?.policies_at_risk || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Breakdown */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{
          fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: '0.06em', marginBottom: '0.35rem', fontWeight: 600,
        }}>
          Compliance Areas
        </div>
        {posture.compliance?.map((area) => {
          const areaColor = area.score >= 90 ? 'var(--status-normal)' : area.score >= 70 ? 'var(--status-suspicious)' : 'var(--status-high)';
          return (
            <div key={area.area} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.3rem 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-primary)', marginBottom: '0.1rem' }}>
                  {area.area}
                </div>
                <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>
                  {area.standard}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '80px' }}>
                <div style={{
                  flex: 1, height: '4px', background: 'var(--bg-tertiary)',
                  borderRadius: '2px', overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${area.score}%`, height: '100%',
                    background: areaColor,
                    borderRadius: '2px',
                    transition: 'width 0.4s ease',
                  }}></div>
                </div>
                <span className="mono" style={{ fontSize: '0.68rem', fontWeight: 600, color: areaColor, width: '26px', textAlign: 'right' }}>
                  {area.score}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
