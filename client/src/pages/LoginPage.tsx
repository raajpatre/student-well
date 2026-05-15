import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiCall } from '../lib/api';

type LoginResponse = { token: string; user: { id: string; tenant_id: string; role: string; full_name: string } };

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const data = await apiCall<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      login(data.token, data.user);
      if (from === '/') {
        switch (data.user.role) {
          case 'student': navigate('/student/dashboard'); break;
          case 'counsellor': navigate('/counsellor'); break;
          case 'manager': navigate('/manager'); break;
          default: navigate('/');
        }
      } else {
        navigate(from, { replace: true });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background min-h-screen font-body-md text-on-surface antialiased flex flex-col items-center pt-[132px] px-container-padding">
      {/* Brand Anchor */}
      <div className="flex flex-col items-center justify-center w-full mb-8">
        <div className="mb-4 text-primary-container">
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '32px', fontVariationSettings: "'FILL' 1" }}
          >
            eco
          </span>
        </div>
        <h1 className="text-[26px] font-light text-primary-container tracking-tight">StudentWell</h1>
      </div>

      {/* Main Content Canvas */}
      <main className="w-full max-w-sm flex-grow">
        {/* Login Card */}
        <div className="bg-surface-container-lowest rounded-card shadow-warm p-lg w-full relative z-10">
          <div className="mb-6">
            <h2 className="text-headline-md text-on-tertiary-container mb-1">Welcome back</h2>
            <p className="text-[13px] text-outline">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-error-container text-on-error-container rounded-input px-4 py-3 text-[13px]">
                {error}
              </div>
            )}

            {/* Email Input */}
            <div className="space-y-1">
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="College email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-[44px] bg-background border border-custom-divider rounded-input px-4 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-colors font-body-md"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-[44px] bg-background border border-custom-divider rounded-input pl-4 pr-10 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-colors font-body-md"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-outline hover:text-on-surface-variant transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    {showPassword ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end pt-1">
              <a href="#" className="text-[12px] text-custom-terracotta hover:opacity-80 transition-opacity">
                Forgot password?
              </a>
            </div>

            {/* Sign In Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[48px] bg-primary-container text-on-primary rounded-btn flex items-center justify-center font-body-md hover:bg-primary transition-colors shadow-sm disabled:opacity-70"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>
        </div>

        {/* Footer Text */}
        <div className="mt-8 text-center px-4">
          <p className="text-[13px] text-outline">
            Reach out to your college administrator<br />if you can't access your account.
          </p>
        </div>
      </main>
    </div>
  );
};
