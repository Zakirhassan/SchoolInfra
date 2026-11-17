import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';
import { validatePasswordForm, MIN_PASSWORD_LENGTH } from '../lib/passwordReminder';

export default function ChangePassword() {
    const { refreshPasswordStatus } = useAuth();
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const problem = validatePasswordForm(oldPassword, newPassword, confirm);
        setError(problem || '');
        if (problem) return;

        setSaving(true);
        try {
            await api.post('/auth/change-password', { oldPassword, newPassword });
            toast.success('Password changed successfully');
            setOldPassword('');
            setNewPassword('');
            setConfirm('');
            refreshPasswordStatus();
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to change password';
            setError(msg);
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-md">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Change Password</h1>
            <p className="text-gray-600 mb-6">Use at least {MIN_PASSWORD_LENGTH} characters. Change it every 30 days.</p>

            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
                {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded">{error}</div>}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
                    <input type="password" className="input-field" autoComplete="current-password"
                        value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                    <input type="password" className="input-field" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH}
                        value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                    <input type="password" className="input-field" autoComplete="new-password"
                        value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-primary w-full" disabled={saving}>
                    {saving ? 'Saving...' : 'Change password'}
                </button>
            </form>
        </div>
    );
}
