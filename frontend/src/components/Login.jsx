import React, { useContext, useState } from 'react';
import { AuthContext } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

export default function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleConnect = async (provider) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/connect`, { provider });
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to connect', error);
      setErrorMsg('Simulation failed. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleLocalAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegister ? { name, email, password } : { email, password };
      
      const res = await axios.post(`${BACKEND_URL}${endpoint}`, payload);
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (error) {
      console.error('Auth failed:', error.response?.data?.error || error.message);
      setErrorMsg(error.response?.data?.error || 'Authentication failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f9fa] flex items-center justify-center p-4 font-sans text-gray-800">
      <div className="max-w-md w-full bg-white/80 backdrop-blur-md shadow-2xl rounded-3xl p-8 border border-white/40">
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg shadow-emerald-200">
            🐷
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 mb-2">no broke</h1>
        <p className="text-center text-gray-500 mb-6 text-sm">AI Student Finance & Burnout Predictor</p>

        {errorMsg && (
          <div className="bg-red-50 text-red-500 text-sm p-3 rounded-lg mb-4 text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLocalAuth} className="space-y-4 mb-6">
          {isRegister && (
            <input 
              type="text" 
              placeholder="Full Name" 
              value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-500" required
            />
          )}
          <input 
            type="email" 
            placeholder="Email Address" 
            value={email} onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-500" required
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} onChange={e => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-500" required
          />
          <button type="submit" disabled={loading} className={`w-full bg-emerald-500 text-white font-semibold py-3 rounded-xl transition shadow-sm ${loading ? 'opacity-50' : 'hover:bg-emerald-600'}`}>
            {isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="text-center text-sm text-gray-500 mb-6">
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <button onClick={() => setIsRegister(!isRegister)} className="text-emerald-600 font-semibold hover:underline">
            {isRegister ? 'Sign In' : 'Register'}
          </button>
        </div>

        <div className="relative flex py-2 items-center mb-6">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">Or try our Mock Demo</span>
            <div className="flex-grow border-t border-gray-200"></div>
        </div>

        <div className="space-y-4">
          <button 
            type="button"
            disabled={loading}
            onClick={() => handleConnect('paytm')}
            className={`w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 border border-[#00baf2] text-[#00baf2] font-semibold py-3 rounded-xl transition shadow-sm ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
           Connect with Paytm
          </button>
          
          <button 
            type="button"
            disabled={loading}
            onClick={() => handleConnect('gpay')}
            className={`w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 border border-[#ea4335] text-[#ea4335] font-semibold py-3 rounded-xl transition shadow-sm ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
           Connect with Google Pay
          </button>
        </div>

        <p className="text-xs text-center text-gray-400 mt-8 leading-relaxed">
          By connecting, you authorize NoBroke to read your transaction history to provide real-time ML burnout and spending pattern analysis.
        </p>

      </div>
    </div>
  );
}
