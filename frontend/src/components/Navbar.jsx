import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav className="bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    <Link to="/" className="flex items-center space-x-2">
                        <div className="text-white text-2xl font-bold">🏫 School MS</div>
                    </Link>

                    <div className="hidden md:flex items-center space-x-6">
                        <Link to="/" className="text-white hover:text-blue-100 transition font-medium">
                            Dashboard
                        </Link>
                        <Link to="/students" className="text-white hover:text-blue-100 transition font-medium">
                            Students
                        </Link>
                        <Link to="/id-cards" className="text-white hover:text-blue-100 transition font-medium">
                            ID Cards
                        </Link>
                        <Link to="/report-cards" className="text-white hover:text-blue-100 transition font-medium">
                            Report Cards
                        </Link>
                        <Link to="/fees" className="text-white hover:text-blue-100 transition font-medium">
                            Fees
                        </Link>
                        <Link to="/export" className="text-white hover:text-blue-100 transition font-medium">
                            Export
                        </Link>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="text-white">
                            <span className="font-medium">{user?.fullName || user?.username}</span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="bg-white text-purple-600 px-4 py-2 rounded-lg font-medium hover:bg-opacity-90 transition btn"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
