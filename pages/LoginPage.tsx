import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  if (user) {
    return <Navigate to="/admin" />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await login(email, password);
      if (error) {
        setError(error.message);
      } else {
        navigate('/admin');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Fixed back button handler
  const handleBack = () => {
    // Check if there's a previous page in history
    if (window.history.length > 2) {
      // Try to go back
      navigate(-1);
    } else {
      // If no history, go to home
      navigate('/');
    }
  };

  return (
    <div className="relative flex items-center justify-center py-12 min-h-screen">
      {/* 🔙 Tombol Back - Fixed version with multiple fallbacks */}
      <div className="absolute top-6 left-6">
        {/* Method 1: Link (most reliable for SPAs) */}
        <Link
          to="/"
          className="text-gray-400 hover:text-brand-secondary transition-colors flex items-center gap-2 group"
        >
          <span className="text-xl group-hover:translate-x-[-4px] transition-transform">←</span>
          <span className="font-medium">Back to Home</span>
        </Link>
        
        {/* Alternative: Button with improved handler (commented out, use if you prefer button) */}
        {/* <button
          onClick={handleBack}
          type="button"
          className="text-gray-400 hover:text-brand-secondary transition-colors flex items-center gap-2 group"
        >
          <span className="text-xl group-hover:translate-x-[-4px] transition-transform">←</span>
          <span className="font-medium">Back</span>
        </button> */}
      </div>

      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-2xl shadow-2xl">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-white">Teacher Login</h1>
          <p className="mt-2 text-gray-400">Access the quiz generation dashboard.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary sm:text-sm text-white p-3"
              placeholder="teacher@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary sm:text-sm text-white p-3"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-md p-3">
              <p className="text-sm text-red-400 flex items-center gap-2">
                <span>⚠️</span>
                {error}
              </p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-brand-primary hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-brand-secondary transition-all duration-300 ease-in-out disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Logging in...
                </span>
              ) : (
                'Log In'
              )}
            </button>
          </div>
        </form>

        {/* Optional: Link ke signup jika ada */}
        {/* <div className="text-center text-sm text-gray-400">
          Don't have an account?{' '}
          <Link to="/signup" className="text-brand-secondary hover:text-brand-primary font-medium">
            Sign up here
          </Link>
        </div> */}
      </div>
    </div>
  );
};

export default LoginPage;