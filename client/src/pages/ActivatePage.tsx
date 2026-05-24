import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface InviteInfo {
  email: string;
  full_name: string;
  tenant_id: string;
  batch: string;
  semester: number;
}

const PasswordRequirement: React.FC<{ met: boolean; label: string }> = ({ met, label }) => (
  <div className={`flex items-center gap-2 text-[12px] transition-colors ${met ? 'text-sage-green' : 'text-outline'}`}>
    <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: met ? "'FILL' 1" : "'FILL' 0" }}>
      {met ? 'check_circle' : 'radio_button_unchecked'}
    </span>
    {label}
  </div>
);

export const ActivatePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [checkState, setCheckState] = useState<'loading' | 'invalid' | 'valid' | 'success'>('loading');
  const [invalidReason, setInvalidReason] = useState<'expired' | 'already_used' | 'not_found'>('not_found');
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const hasLength = password.length >= 8;
  const hasNumber = /[0-9]/.test(password);
  const hasLetter = /[a-zA-Z]/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  useEffect(() => {
    if (!token) {
      setCheckState('invalid');
      setInvalidReason('not_found');
      return;
    }

    fetch(`${BASE_URL}/api/auth/activate?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setInviteInfo({
            email: data.email,
            full_name: data.full_name,
            tenant_id: data.tenant_id,
            batch: data.batch,
            semester: data.semester,
          });
          setCheckState('valid');
        } else {
          setInvalidReason(data.reason || 'not_found');
          setCheckState('invalid');
        }
      })
      .catch(() => {
        setInvalidReason('not_found');
        setCheckState('invalid');
      });
  }, [token]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasLength || !hasNumber || !hasLetter || !passwordsMatch) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      if (inviteInfo) {
        sessionStorage.setItem('sw_prefill_email', inviteInfo.email);
      }

      const res = await fetch(`${BASE_URL}/api/auth/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || 'Activation failed. Please try again.');
        return;
      }

      setCheckState('success');
    } catch {
      setSubmitError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkState === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-container border-t-transparent rounded-full animate-spin" />
          <p className="text-[14px] text-outline">Verifying your invite link…</p>
        </div>
      </div>
    );
  }

  if (checkState === 'invalid') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="bg-surface-container-lowest rounded-card shadow-warm p-lg text-center max-w-sm w-full">
          <div className="w-14 h-14 rounded-full bg-error-container flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-on-error-container" style={{ fontSize: '28px' }}>link_off</span>
          </div>
          <h1 className="text-[20px] font-light text-on-surface mb-2">
            {invalidReason === 'already_used'
              ? 'Link already used'
              : 'This invite link has expired.'}
          </h1>
          <p className="text-[13px] text-outline leading-relaxed">
            {invalidReason === 'already_used'
              ? 'Your account has already been activated. Sign in to continue.'
              : 'Ask your college administrator to send you a new invite.'}
          </p>
          {invalidReason === 'already_used' && (
            <button
              onClick={() => navigate('/login')}
              className="mt-6 w-full h-[44px] bg-primary-container text-on-primary rounded-btn font-body-md hover:bg-primary transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    );
  }

  if (checkState === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="bg-surface-container-lowest rounded-card shadow-warm p-lg text-center max-w-sm w-full">
          <div className="w-14 h-14 rounded-full bg-primary-fixed flex items-center justify-center mx-auto mb-4">
            <span
              className="material-symbols-outlined text-on-primary-fixed"
              style={{ fontSize: '28px', fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
          </div>
          <h1 className="text-[22px] font-light text-on-surface mb-2">You're all set.</h1>
          <p className="text-[13px] text-outline mb-6">Your StudentWell account is ready.</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full h-[48px] bg-primary-container text-on-primary rounded-btn font-body-md hover:bg-primary transition-colors"
          >
            Sign in to StudentWell
          </button>
        </div>
      </div>
    );
  }

  // Valid token — show password setup form
  return (
    <div className="bg-background min-h-screen font-body-md text-on-surface antialiased flex flex-col items-center pt-[100px] px-container-padding">
      <div className="flex flex-col items-center mb-8">
        <div className="mb-3 text-primary-container">
          <span className="material-symbols-outlined" style={{ fontSize: '32px', fontVariationSettings: "'FILL' 1" }}>
            eco
          </span>
        </div>
        <h1 className="text-[26px] font-light text-primary-container tracking-tight">StudentWell</h1>
      </div>

      <div className="w-full max-w-sm">
        <div className="bg-surface-container-lowest rounded-card shadow-warm p-lg w-full">
          <div className="mb-6">
            <h2 className="text-[20px] font-light text-on-surface mb-1">
              Welcome, {inviteInfo?.full_name?.split(' ')[0]}
            </h2>
            <p className="text-[13px] text-outline">
              Setting up your StudentWell account
              {inviteInfo?.batch ? ` for ${inviteInfo.batch}` : ''}
            </p>
          </div>

          <form onSubmit={handleActivate} className="space-y-4">
            {submitError && (
              <div className="bg-error-container text-on-error-container rounded-input px-4 py-3 text-[13px]">
                {submitError}
              </div>
            )}

            {/* Create password */}
            <div>
              <label className="block text-[12px] text-on-surface-variant mb-1">Create password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full h-[44px] bg-background border border-custom-divider rounded-input px-4 pr-10 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-outline hover:text-on-surface-variant"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    {showPassword ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>

              {/* Password requirements */}
              {password.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  <PasswordRequirement met={hasLength} label="At least 8 characters" />
                  <PasswordRequirement met={hasNumber} label="Contains a number" />
                  <PasswordRequirement met={hasLetter} label="Contains a letter" />
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-[12px] text-on-surface-variant mb-1">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full h-[44px] bg-background border border-custom-divider rounded-input px-4 pr-10 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-outline hover:text-on-surface-variant"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    {showConfirm ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="mt-1 text-[12px] text-on-error-container">Passwords do not match</p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || !hasLength || !hasNumber || !hasLetter || !passwordsMatch}
                className="w-full h-[48px] bg-primary-container text-on-primary rounded-btn font-body-md hover:bg-primary transition-colors disabled:opacity-50"
              >
                {submitting ? 'Activating…' : 'Activate my account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
