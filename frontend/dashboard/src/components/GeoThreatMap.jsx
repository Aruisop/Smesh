import React, { useState, useEffect, useMemo } from 'react';

/**
 * GeoThreatMap — SVG world map visualization showing attack origins
 * and traffic flow with animated attack lines.
 */
export default function GeoThreatMap({ api }) {
  const [attackers, setAttackers] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/attackers?limit=15');
        setAttackers(res.data.attackers || []);
      } catch {
        setAttackers([]);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [api]);

  // Mock geographic positions based on IP octets
  const ipToPosition = (ip) => {
    const parts = ip.split('.').map(Number);
    const x = ((parts[0] * 7 + parts[1] * 3) % 800) + 40;
    const y = ((parts[2] * 5 + parts[3] * 2) % 300) + 30;
    return { x, y };
  };

  // Target position (our defended network)
  const target = { x: 440, y: 180 };

  // Generate node positions for attackers
  const nodes = useMemo(() => {
    return attackers.map((a) => ({
      ...a,
      pos: ipToPosition(a.ip),
      intensity: Math.min(a.threat_score / 100, 1),
    }));
  }, [attackers]);

  const [hoveredNode, setHoveredNode] = useState(null);

  return (
    <div className="geo-map-container">
      <svg viewBox="0 0 880 380" style={{ width: '100%', height: '100%' }}>
        <defs>
          <radialGradient id="targetGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="attackGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
          </radialGradient>
          <filter id="mapGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="attackLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`h-${i}`} x1="0" y1={i * 42 + 20} x2="880" y2={i * 42 + 20} className="geo-grid-line" />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <line key={`v-${i}`} x1={i * 73 + 20} y1="0" x2={i * 73 + 20} y2="380" className="geo-grid-line" />
        ))}

        {/* Simplified world outlines (decorative dots) */}
        {[
          // NA
          { x: 200, y: 100 }, { x: 220, y: 90 }, { x: 180, y: 120 }, { x: 240, y: 110 },
          { x: 160, y: 140 }, { x: 200, y: 130 }, { x: 220, y: 140 }, { x: 250, y: 130 },
          // EU
          { x: 440, y: 80 }, { x: 460, y: 90 }, { x: 420, y: 100 }, { x: 480, y: 85 },
          { x: 450, y: 110 }, { x: 470, y: 100 }, { x: 430, y: 120 },
          // AS
          { x: 620, y: 90 }, { x: 650, y: 100 }, { x: 680, y: 110 }, { x: 700, y: 130 },
          { x: 660, y: 140 }, { x: 640, y: 120 }, { x: 720, y: 150 },
          // SA
          { x: 280, y: 230 }, { x: 290, y: 250 }, { x: 270, y: 270 }, { x: 300, y: 260 },
          // AF
          { x: 480, y: 180 }, { x: 500, y: 200 }, { x: 490, y: 220 }, { x: 510, y: 190 },
          // OC
          { x: 740, y: 260 }, { x: 760, y: 270 }, { x: 750, y: 280 },
        ].map((dot, i) => (
          <circle key={`world-${i}`} cx={dot.x} cy={dot.y} r="2" fill="rgba(255,255,255,0.06)" />
        ))}

        {/* Attack lines */}
        {nodes.map((node, i) => (
          <g key={`attack-${i}`}>
            <line
              x1={node.pos.x}
              y1={node.pos.y}
              x2={target.x}
              y2={target.y}
              stroke="#EF4444"
              strokeWidth={Math.max(0.5, node.intensity * 2)}
              opacity="0"
              strokeDasharray="6,4"
            >
              <animate
                attributeName="opacity"
                values="0;0.6;0.6;0"
                dur={`${2 + i * 0.5}s`}
                repeatCount="indefinite"
                begin={`${i * 0.3}s`}
              />
              <animate
                attributeName="stroke-dashoffset"
                from="100"
                to="0"
                dur={`${2 + i * 0.5}s`}
                repeatCount="indefinite"
                begin={`${i * 0.3}s`}
              />
            </line>
          </g>
        ))}

        {/* Target node (defended network) */}
        <circle cx={target.x} cy={target.y} r="35" fill="url(#targetGlow)" />
        <circle cx={target.x} cy={target.y} r="10" fill="var(--bg-tertiary)" stroke="#06B6D4" strokeWidth="2" filter="url(#mapGlow)">
          <animate attributeName="r" values="10;12;10" dur="3s" repeatCount="indefinite" />
        </circle>
        <text x={target.x} y={target.y + 1} textAnchor="middle" dominantBaseline="middle" fill="#06B6D4" fontSize="6" fontWeight="700">
          NET
        </text>
        <text x={target.x} y={target.y + 22} textAnchor="middle" fill="var(--text-muted)" fontSize="6.5">
          Protected Network
        </text>

        {/* Attacker nodes */}
        {nodes.map((node, i) => {
          const isHovered = hoveredNode === node.ip;
          const color = node.intensity > 0.5 ? '#EF4444' : '#F97316';
          const r = 4 + node.intensity * 3;

          return (
            <g
              key={`node-${i}`}
              onMouseEnter={() => setHoveredNode(node.ip)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Pulse for high-threat */}
              {node.intensity > 0.5 && (
                <circle cx={node.pos.x} cy={node.pos.y} r={r} fill="none" stroke={color} strokeWidth="1" opacity="0.4">
                  <animate attributeName="r" from={r} to={r + 8} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite" />
                </circle>
              )}

              <circle
                cx={node.pos.x}
                cy={node.pos.y}
                r={isHovered ? r + 2 : r}
                fill={color}
                fillOpacity={isHovered ? 0.95 : 0.7}
                stroke={isHovered ? '#fff' : color}
                strokeWidth={isHovered ? 1.5 : 0.5}
                filter="url(#mapGlow)"
              />

              {/* Tooltip */}
              {isHovered && (
                <>
                  <rect
                    x={node.pos.x - 50}
                    y={node.pos.y - r - 28}
                    width="100"
                    height="22"
                    rx="4"
                    fill="var(--bg-quaternary)"
                    stroke="var(--border-color)"
                    strokeWidth="0.5"
                  />
                  <text
                    x={node.pos.x}
                    y={node.pos.y - r - 21}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="var(--text-primary)"
                    fontSize="6.5"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {node.ip}
                  </text>
                  <text
                    x={node.pos.x}
                    y={node.pos.y - r - 12}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={color}
                    fontSize="5.5"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    Score: {node.threat_score}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Map stats */}
      <div style={{
        position: 'absolute',
        bottom: '6px',
        left: '8px',
        display: 'flex',
        gap: '1rem',
        fontSize: '0.65rem',
        color: 'var(--text-muted)',
      }}>
        <span>{nodes.length} attacker{nodes.length !== 1 ? 's' : ''} tracked</span>
        <span style={{ color: 'var(--accent-cyan)' }}>●</span>
        <span>Protected</span>
        <span style={{ color: 'var(--status-high)' }}>●</span>
        <span>Threat Source</span>
      </div>
    </div>
  );
}
