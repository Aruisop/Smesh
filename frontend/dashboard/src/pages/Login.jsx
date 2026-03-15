import React, { useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { Shield, Github, ChevronRight, AlertCircle, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loginDemo, loginGithub, error: authError, setError } = useAuth();
  const [demoLoading, setDemoLoading] = useState(false);

  // If already authenticated, redirect to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Check for error passed via URL params (from OAuth failures)
  const urlError = searchParams.get('error');
  const displayError = authError || (urlError && decodeURIComponent(urlError).replace(/_/g, ' '));

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setError(null);
    const success = await loginDemo();
    if (success) {
      navigate('/dashboard');
    }
    setDemoLoading(false);
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>

      {/* Animated background particles */}
      <div className="login-bg-effects">
        <div className="particle particle-1"></div>
        <div className="particle particle-2"></div>
        <div className="particle particle-3"></div>
      </div>

      <div className="glass-panel slide-in" style={{ 
        padding: '3rem', 
        maxWidth: '440px', 
        width: '100%', 
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
      }}>
        
        {/* Logo */}
        <div style={{ 
          display: 'inline-flex', 
          padding: '1rem', 
          background: 'var(--bg-tertiary)', 
          borderRadius: '20px', 
          marginBottom: '1.5rem', 
          boxShadow: 'var(--shadow-glow)',
          position: 'relative',
        }}>
          <Shield size={48} color="var(--accent-cyan)" />
          <div className="shield-pulse"></div>
        </div>
        
        <h1 style={{ marginBottom: '0.5rem', fontSize: '1.8rem' }}>SentinelMesh</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '0.95rem' }}>
          AI-Powered Network Security Operations Center
        </p>

        {/* Error Message */}
        {displayError && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            marginBottom: '1.5rem',
            backgroundColor: 'var(--status-high-bg)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            textAlign: 'left',
          }}>
            <AlertCircle size={20} color="var(--status-high)" style={{ flexShrink: 0 }} />
            <span style={{ color: 'var(--status-high)', fontSize: '0.85rem' }}>
              {displayError}
            </span>
          </div>
        )}

        {/* GitHub Login */}
        <button 
          id="github-login-btn"
          onClick={loginGithub}
          className="flex-center login-btn-github"
          style={{
            width: '100%',
            padding: '0.85rem',
            marginBottom: '1rem',
            backgroundColor: '#24292e',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '500',
            transition: 'all 0.25s ease',
            gap: '0.75rem',
          }}
        >
          <Github size={20} />
          Continue with GitHub
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
          <span style={{ padding: '0 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>or</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
        </div>

        {/* Demo Login */}
        <button 
          id="demo-login-btn"
          onClick={handleDemoLogin}
          disabled={demoLoading}
          className="flex-center login-btn-demo"
          style={{
            width: '100%',
            padding: '0.85rem',
            backgroundColor: 'transparent',
            color: 'var(--accent-cyan)',
            border: '1px solid var(--accent-cyan)',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '500',
            transition: 'all 0.25s ease',
            opacity: demoLoading ? 0.7 : 1,
            gap: '0.5rem',
          }}
        >
          {demoLoading ? (
            <>
              <Loader size={18} className="spin-animation" />
              Authenticating...
            </>
          ) : (
            <>
              Access Demo Environment
              <ChevronRight size={18} />
            </>
          )}
        </button>

        <p style={{ 
          marginTop: '1.5rem', 
          color: 'var(--text-muted)', 
          fontSize: '0.75rem',
          lineHeight: '1.5',
        }}>
          Demo mode provides full access with sample data.<br />
          No GitHub account required.
        </p>
      </div>

      <p style={{ 
        marginTop: '2.5rem', 
        color: 'var(--text-muted)', 
        fontSize: '0.85rem',
        position: 'relative',
        zIndex: 1,
      }}>
        SentinelMesh Platform v1.0
      </p>
    </div>
  );
}
