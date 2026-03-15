import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Loader, AlertCircle } from 'lucide-react';

/**
 * OAuth Callback Page
 * 
 * This page is where GitHub OAuth redirects to after the user authorizes.
 * The API gateway redirects here with ?token=... in the URL.
 * 
 * Flow:
 * 1. User clicks "Continue with GitHub" → redirects to API /api/auth/github
 * 2. API redirects to GitHub authorize page
 * 3. User authorizes → GitHub redirects to API callback
 * 4. API exchanges code for token, creates JWT, redirects HERE with ?token=jwt
 * 5. This page extracts the token, stores it, verifies it, then redirects to /dashboard
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleOAuthCallback, user } = useAuth();
  const [status, setStatus] = useState('processing');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const process = async () => {
      // Check for errors from the OAuth flow
      const error = searchParams.get('error');
      if (error) {
        setStatus('error');
        const messages = {
          'no_code': 'GitHub did not return an authorization code.',
          'invalid_state': 'Security validation failed. Please try again.',
          'oauth_failed': 'OAuth authentication failed. Please try again.',
          'auth_failed': 'Could not obtain access token from GitHub.',
          'access_denied': 'You denied the authorization request.',
        };
        setErrorMsg(messages[error] || `Authentication error: ${error}`);
        return;
      }

      // Extract token
      const token = searchParams.get('token');
      if (!token) {
        setStatus('error');
        setErrorMsg('No authentication token received.');
        return;
      }

      // Verify and store token
      const success = await handleOAuthCallback(token);
      if (success) {
        setStatus('success');
        // Small delay for the user to see success state, then redirect
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 500);
      } else {
        setStatus('error');
        setErrorMsg('Failed to verify authentication token.');
      }
    };

    process();
  }, [searchParams, handleOAuthCallback, navigate]);

  // If user is already set (e.g. from a fast verification), redirect
  useEffect(() => {
    if (user && status === 'success') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, status, navigate]);

  return (
    <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div className="glass-panel slide-in" style={{ 
        padding: '3rem', 
        maxWidth: '440px', 
        width: '100%', 
        textAlign: 'center' 
      }}>
        {status === 'processing' && (
          <>
            <div className="auth-spinner" style={{ marginBottom: '1.5rem' }}>
              <Loader size={48} className="spin-animation" color="var(--accent-cyan)" />
            </div>
            <h2 style={{ marginBottom: '0.5rem' }}>Authenticating...</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Verifying your GitHub credentials
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ 
              display: 'inline-flex', 
              padding: '1rem', 
              background: 'rgba(16, 185, 129, 0.15)', 
              borderRadius: '50%', 
              marginBottom: '1.5rem' 
            }}>
              <Shield size={48} color="var(--status-normal)" />
            </div>
            <h2 style={{ marginBottom: '0.5rem', color: 'var(--status-normal)' }}>
              Authenticated!
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Redirecting to dashboard...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ 
              display: 'inline-flex', 
              padding: '1rem', 
              background: 'rgba(239, 68, 68, 0.15)', 
              borderRadius: '50%', 
              marginBottom: '1.5rem' 
            }}>
              <AlertCircle size={48} color="var(--status-high)" />
            </div>
            <h2 style={{ marginBottom: '0.5rem', color: 'var(--status-high)' }}>
              Authentication Failed
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              {errorMsg}
            </p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              style={{
                padding: '0.75rem 2rem',
                backgroundColor: 'var(--accent-cyan)',
                color: 'var(--bg-primary)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseOver={(e) => e.target.style.opacity = '0.85'}
              onMouseOut={(e) => e.target.style.opacity = '1'}
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
