import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [passwordStatus, setPasswordStatus] = useState(null);

    useEffect(() => {
        // Check if user is logged in
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (token && savedUser) {
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    const refreshPasswordStatus = useCallback(async () => {
        try {
            const { data } = await api.get('/auth/password-status');
            setPasswordStatus(data);
        } catch {
            setPasswordStatus(null);
        }
    }, []);

    // Fetch once per login / app load, admins only
    const userId = user?.id;
    const userRole = user?.role;
    useEffect(() => {
        if (userRole === 'ADMIN') refreshPasswordStatus();
        else setPasswordStatus(null);
    }, [userId, userRole, refreshPasswordStatus]);

    const login = async (username, password) => {
        try {
            const response = await api.post('/auth/login', { username, password });
            const { token, user: userData } = response.data;

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || 'Login failed'
            };
        }
    };

    const logout = () => {
        try { sessionStorage.removeItem('pwdBannerDismissed'); } catch { /* ignore */ }
        setPasswordStatus(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, passwordStatus, refreshPasswordStatus }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
