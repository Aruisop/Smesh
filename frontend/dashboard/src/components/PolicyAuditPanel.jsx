import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, FileSearch, ChevronRight } from 'lucide-react';

/**
 * PolicyAuditPanel — A1 Policy Zero-Trust Audit Interface.
 * Shows active A1 policies with risk scores, audit status, and
 * allows triggering RAG-based security validation against O-RAN specs.
 */
export default function PolicyAuditPanel({ api }) {
  const [policies, setPolicies] = useState([]);
  const [meta, setMeta] = useState({ total: 0, at_risk: 0, audit_required: 0 });
  const [auditResult, setAuditResult] = useState(null);
  const [auditing, setAuditing] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/oran/policies');
        setPolicies(res.data.policies || []);
        setMeta(res.data.meta || {});
      } catch {
        setPolicies([]);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [api]);

  const handleAudit = async (policyId) => {
    setAuditing(policyId);
    setAuditResult(null);
    try {
      const res = await api.post('/oran/policies/audit', { policy_id: policyId });
      setAuditResult(res.data.audit);
    } catch {
      setAuditResult({ error: true });
    }
    setAuditing(null);
  };

  const getRiskColor = (score) => {
    if (score >= 0.6) return 'var(--status-high)';
    if (score >= 0.3) return 'var(--status-suspicious)';
    return 'var(--status-normal)';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE': return 'badge-normal';
      case 'AUDIT_REQUIRED': return 'badge-high';
      default: return 'badge-suspicious';
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Summary bar */}
      <div style={{
        display: 'flex', gap: '1rem', padding: '0.5rem 0.75rem',
        background: 'var(--bg-secondary)', borderRadius: '6px',
        border: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem' }}>
          <Shield size={12} color="var(--accent-blue)" />
          <span style={{ color: 'var(--text-secondary)' }}>Policies: </span>
          <span className="mono" style={{ fontWeight: 600 }}>{meta.total}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem' }}>
          <AlertTriangle size={12} color="var(--status-high)" />
          <span style={{ color: 'var(--text-secondary)' }}>At Risk: </span>
          <span className="mono" style={{ fontWeight: 600, color: meta.at_risk > 0 ? 'var(--status-high)' : 'var(--status-normal)' }}>
            {meta.at_risk}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem' }}>
          <FileSearch size={12} color="var(--status-suspicious)" />
          <span style={{ color: 'var(--text-secondary)' }}>Audit Required: </span>
          <span className="mono" style={{ fontWeight: 600, color: meta.audit_required > 0 ? 'var(--status-suspicious)' : 'var(--status-normal)' }}>
            {meta.audit_required}
          </span>
        </div>
      </div>

      {/* Policy List */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {policies.map((policy) => (
          <div key={policy.policy_id} style={{
            padding: '0.6rem 0.75rem',
            marginBottom: '0.3rem',
            background: 'var(--bg-secondary)',
            border: `1px solid ${policy.risk_score > 0.5 ? 'rgba(239,68,68,0.2)' : 'var(--border-color)'}`,
            borderRadius: '8px',
            transition: 'all 0.2s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="mono" style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                  {policy.policy_id}
                </span>
                <span className={`badge ${getStatusBadge(policy.status)}`}>
                  {policy.status}
                </span>
              </div>
              <button
                onClick={() => handleAudit(policy.policy_id)}
                disabled={auditing === policy.policy_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.25rem 0.5rem', fontSize: '0.65rem',
                  background: 'rgba(6, 182, 212, 0.1)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  borderRadius: '4px', color: 'var(--accent-cyan)',
                  cursor: auditing === policy.policy_id ? 'wait' : 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: "'JetBrains Mono', monospace",
                  opacity: auditing === policy.policy_id ? 0.6 : 1,
                }}
              >
                <FileSearch size={11} />
                {auditing === policy.policy_id ? 'Auditing...' : 'Audit'}
              </button>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              {policy.policy_type}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.68rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Risk:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <div style={{
                  width: '50px', height: '4px', background: 'var(--bg-tertiary)',
                  borderRadius: '2px', overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${policy.risk_score * 100}%`, height: '100%',
                    background: getRiskColor(policy.risk_score),
                    borderRadius: '2px', transition: 'width 0.3s ease',
                  }}></div>
                </div>
                <span className="mono" style={{ color: getRiskColor(policy.risk_score), fontWeight: 600 }}>
                  {(policy.risk_score * 100).toFixed(0)}%
                </span>
              </div>
              {policy.audit_flags && (
                <span style={{ color: 'var(--status-suspicious)', fontSize: '0.62rem' }}>
                  ⚠ {policy.audit_flags[0]}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Audit Result */}
      {auditResult && !auditResult.error && (
        <div style={{
          padding: '0.75rem',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--accent-cyan)',
          borderRadius: '8px',
          animation: 'slideInUp 0.2s ease-out',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span className="mono" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
              Audit: {auditResult.policy_id}
            </span>
            <span className={`badge ${auditResult.overall_risk === 'HIGH' ? 'badge-high' : auditResult.overall_risk === 'MEDIUM' ? 'badge-suspicious' : 'badge-normal'}`}>
              {auditResult.overall_risk} RISK
            </span>
          </div>

          {/* Security Checks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.5rem' }}>
            {auditResult.security_checks?.map((check, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                fontSize: '0.68rem', padding: '0.25rem 0',
              }}>
                {check.status === 'PASS' ? (
                  <CheckCircle size={12} color="var(--status-normal)" />
                ) : check.status === 'FAIL' ? (
                  <XCircle size={12} color="var(--status-high)" />
                ) : (
                  <AlertTriangle size={12} color="var(--status-suspicious)" />
                )}
                <span className="mono" style={{
                  color: check.status === 'PASS' ? 'var(--status-normal)' : check.status === 'FAIL' ? 'var(--status-high)' : 'var(--status-suspicious)',
                  fontWeight: 600, width: '35px',
                }}>
                  {check.status}
                </span>
                <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
                  {check.rule}
                </span>
              </div>
            ))}
          </div>

          {/* Recommendation */}
          <div style={{
            padding: '0.4rem 0.6rem',
            background: auditResult.overall_risk === 'HIGH' ? 'var(--status-high-bg)' : auditResult.overall_risk === 'MEDIUM' ? 'var(--status-suspicious-bg)' : 'var(--status-normal-bg)',
            borderRadius: '4px',
            fontSize: '0.7rem',
            color: 'var(--text-primary)',
          }}>
            <ChevronRight size={11} style={{ display: 'inline', marginRight: '0.25rem' }} />
            {auditResult.recommendation}
          </div>
        </div>
      )}
    </div>
  );
}
