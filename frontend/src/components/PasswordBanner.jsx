import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { shouldShowBanner } from '../lib/passwordReminder';

const KEY = 'pwdBannerDismissed';
const wasDismissed = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } };

export default function PasswordBanner() {
    const { user, passwordStatus } = useAuth();
    const { pathname } = useLocation();
    const [dismissed, setDismissed] = useState(wasDismissed);

    if (!shouldShowBanner(user?.role, passwordStatus, dismissed, pathname)) return null;

    const dismiss = () => {
        try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }
        setDismissed(true);
    };

    return (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            <span>
                Your password is 30+ days old - please <Link to="/change-password" className="font-semibold underline">change it</Link>.
            </span>
            <button onClick={dismiss} aria-label="Dismiss" className="text-yellow-700 hover:text-yellow-900 text-lg leading-none">&times;</button>
        </div>
    );
}
