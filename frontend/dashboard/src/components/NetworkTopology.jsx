import React, { useState, useEffect, useRef } from 'react';

/**
 * NetworkTopology — Interactive SVG visualization showing network nodes
 * and attack paths. Shows internal vs external hosts, with threat-level
 * color coding and connection lines.
 */
export default function NetworkTopology({ api }) {
  const [data, setData] = useState({ nodes: [], edges: [] });
  const svgRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/topology');
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch topology', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [api]);

  const getNodeColor = (node) => {
    if (node.threatLevel >= 0.8) return '#EF4444';
    if (node.threatLevel >= 0.5) return '#F97316';
    if (node.threatLevel >= 0.3) return '#F59E0B';
    return node.type === 'internal' ? '#10B981' : '#3B82F6';
  };

  const getNodeRadius = (node) => {
    const base = node.type === 'internal' ? 6 : 5;
    return Math.min(base + node.connections * 0.5, 14);
  };

  // Layout nodes in a force-like arrangement
  const layoutNodes = (nodes) => {
    if (!nodes.length) return [];
    
    const width = 560;
    const height = 250;
    const centerX = width / 2;
    const centerY = height / 2;

    // Separate internal and external
    const internal = nodes.filter(n => n.type === 'internal');
    const external = nodes.filter(n => n.type === 'external');

    const positioned = [];

    // Internal nodes: inner ring
    internal.forEach((node, i) => {
      const angle = (i / Math.max(internal.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const radius = 60 + Math.random() * 30;
      positioned.push({
        ...node,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      });
    });

    // External nodes: outer ring
    external.forEach((node, i) => {
      const angle = (i / Math.max(external.length, 1)) * Math.PI * 2;
      const radius = 100 + Math.random() * 20;
      positioned.push({
        ...node,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      });
    });

    return positioned;
  };

  const positioned = layoutNodes(data.nodes);
  
  // Firewall node at center
  const centerX = 280;
  const centerY = 125;

  if (!data.nodes.length) {
    return (
      <div className="flex-center" style={{ height: '100%', color: 'var(--text-muted)' }}>
        Waiting for network data...
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 560 250"
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <radialGradient id="fwGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connection lines from nodes to center (firewall) */}
        {positioned.map((node, i) => (
          <line
            key={`edge-${i}`}
            x1={node.x}
            y1={node.y}
            x2={centerX}
            y2={centerY}
            stroke={node.threatLevel >= 0.5 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'}
            strokeWidth={node.threatLevel >= 0.5 ? 1.5 : 0.5}
            strokeDasharray={node.type === 'external' ? '3,3' : 'none'}
          />
        ))}

        {/* Center firewall node */}
        <circle cx={centerX} cy={centerY} r="30" fill="url(#fwGlow)" />
        <circle cx={centerX} cy={centerY} r="12" fill="var(--bg-tertiary)" stroke="var(--accent-cyan)" strokeWidth="2" filter="url(#glow)" />
        <text x={centerX} y={centerY + 1} textAnchor="middle" dominantBaseline="middle" fill="var(--accent-cyan)" fontSize="7" fontWeight="700">
          FW
        </text>
        <text x={centerX} y={centerY + 24} textAnchor="middle" fill="var(--text-muted)" fontSize="6">
          Firewall
        </text>

        {/* Network nodes */}
        {positioned.map((node, i) => {
          const r = getNodeRadius(node);
          const color = getNodeColor(node);
          const isHovered = hoveredNode === node.id;

          return (
            <g
              key={`node-${i}`}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Pulse ring for high-threat */}
              {node.threatLevel >= 0.7 && (
                <circle cx={node.x} cy={node.y} r={r + 4} fill="none" stroke={color} strokeWidth="1" opacity="0.4">
                  <animate attributeName="r" from={r + 2} to={r + 8} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite" />
                </circle>
              )}

              <circle
                cx={node.x}
                cy={node.y}
                r={isHovered ? r + 2 : r}
                fill={color}
                fillOpacity={isHovered ? 0.9 : 0.7}
                stroke={isHovered ? '#fff' : color}
                strokeWidth={isHovered ? 1.5 : 0.5}
                filter={node.threatLevel >= 0.5 ? 'url(#glow)' : 'none'}
              />

              {/* IP label on hover */}
              {isHovered && (
                <>
                  <rect
                    x={node.x - 40}
                    y={node.y - r - 20}
                    width="80"
                    height="16"
                    rx="3"
                    fill="var(--bg-tertiary)"
                    stroke="var(--border-color)"
                    strokeWidth="0.5"
                  />
                  <text
                    x={node.x}
                    y={node.y - r - 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="var(--text-primary)"
                    fontSize="6"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {node.id}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: '4px',
        right: '8px',
        display: 'flex',
        gap: '0.75rem',
        fontSize: '0.65rem',
        color: 'var(--text-muted)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }}></span>
          Internal
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3B82F6' }}></span>
          External
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#EF4444' }}></span>
          Threat
        </span>
      </div>
    </div>
  );
}
