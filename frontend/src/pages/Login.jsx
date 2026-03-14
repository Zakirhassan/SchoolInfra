import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdVisibility, MdVisibilityOff, MdSchool } from 'react-icons/md';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(username, password);

        if (result.success) {
            navigate('/');
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Side - Branding */}
            <div className="hidden lg:flex lg:w-3/6 bg-gradient-to-br from-primary-600 via-primary-700 to-purple-700 p-12 flex-col justify-between relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-white opacity-5 rounded-full translate-y-1/2 -translate-x-1/2"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center">
                            <MdSchool className="text-primary-600" size={32} />
                        </div>
                        <div>
                            <h1 className="text-white text-2xl font-bold">ASDC-ZRM</h1>
                            <p className="text-blue-100 text-sm font-medium uppercase tracking-wider">Advance Skill Development Center</p>
                        </div>
                    </div>

                    <h2 className="text-4xl font-bold text-white mb-4">
                        ASDC - School Management System
                    </h2>
                    <p className="text-blue-100 text-lg">
                        Empowering education with advanced management tools.
                    </p>
                </div>

                <div className="relative z-10 space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0 text-white">
                            ✓
                        </div>
                        <div>
                            <h3 className="text-white font-semibold">Admin Management</h3>
                            <p className="text-blue-100 text-sm">System configuration and security control</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0 text-white">
                            ✓
                        </div>
                        <div>
                            <h3 className="text-white font-semibold">Teacher Management</h3>
                            <p className="text-blue-100 text-sm">Manage staff and academic schedules</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0 text-white">
                            ✓
                        </div>
                        <div>
                            <h3 className="text-white font-semibold">Student Management</h3>
                            <p className="text-blue-100 text-sm">Complete student lifecycle tracking</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0 text-white">
                            ✓
                        </div>
                        <div>
                            <h3 className="text-white font-semibold">Report Generation</h3>
                            <p className="text-blue-100 text-sm">Automated ID cards and certificates</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center gap-3 mb-8">
                        <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center">
                            <MdSchool className="text-white" size={28} />
                        </div>
                        <div>
                            <h1 className="text-gray-800 text-xl font-bold">ASDC-ZRM</h1>
                            <p className="text-gray-600 text-sm">Advance Skill Development Center</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-strong p-8 animate-scale-in">
                        <div className="mb-8">
                            <h2 className="text-3xl font-bold text-gray-800 mb-2">Sign In</h2>
                            <p className="text-gray-600">Enter your credentials to access your account</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg animate-fade-in">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Username
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="input-field"
                                    placeholder="Enter your username"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="input-field pr-12"
                                        placeholder="Enter your password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                    >
                                        {showPassword ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full btn btn-primary btn-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Signing in...</span>
                                    </div>
                                ) : (
                                    'Sign In'
                                )}
                            </button>
                        </form>

                        {/* <div className="mt-6 text-center">
                            <p className="text-sm text-gray-600">
                                Default credentials: <span className="font-semibold">admin</span> / <span className="font-semibold">admin123</span>
                            </p>
                        </div> */}
                    </div>

                    <p className="text-center text-sm text-gray-600 mt-6">
                        © 2026 ASDC. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    );
}
