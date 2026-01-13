import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    MdDashboard,
    MdPeople,
    MdSchool,
    MdAssessment,
    MdAttachMoney,
    MdFileDownload,
    MdMenu,
    MdClose,
    MdLogout,
    MdChevronLeft,
    MdChevronRight
} from 'react-icons/md';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
    const location = useLocation();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const menuItems = [
        { path: '/', icon: MdDashboard, label: 'Dashboard' },
        { path: '/students', icon: MdPeople, label: 'Students' },
        { path: '/classes', icon: MdSchool, label: 'Classes' },
        { path: '/report-cards', icon: MdAssessment, label: 'Report Cards' },
        { path: '/fees', icon: MdAttachMoney, label: 'Fees' },
        { path: '/export', icon: MdFileDownload, label: 'Export Data' },
    ];

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path) => {
        return location.pathname === path;
    };

    return (
        <>
            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                            S
                        </div>
                        {!collapsed && (
                            <div>
                                <h1 className="text-white font-bold text-lg">School MS</h1>
                                <p className="text-xs text-gray-400">Management System</p>
                            </div>
                        )}
                    </div>

                    {/* Desktop collapse toggle */}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="hidden md:block text-gray-400 hover:text-white transition"
                    >
                        {collapsed ? <MdChevronRight size={24} /> : <MdChevronLeft size={24} />}
                    </button>

                    {/* Mobile close button */}
                    <button
                        onClick={() => setMobileOpen(false)}
                        className="md:hidden text-gray-400 hover:text-white transition"
                    >
                        <MdClose size={24} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-4 overflow-y-auto">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
                                onClick={() => setMobileOpen(false)}
                            >
                                <Icon className="icon" />
                                <span className="text">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User section */}
                <div className="border-t border-gray-700 p-4">
                    {!collapsed ? (
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                                {user?.fullName?.[0] || user?.username?.[0] || 'A'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-medium truncate">
                                    {user?.fullName || user?.username}
                                </p>
                                <p className="text-gray-400 text-xs">Administrator</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-center mb-3">
                            <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                                {user?.fullName?.[0] || user?.username?.[0] || 'A'}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleLogout}
                        className="sidebar-item w-full justify-center hover:bg-red-600"
                    >
                        <MdLogout className="icon" />
                        <span className="text">Logout</span>
                    </button>
                </div>
            </div>
        </>
    );
}
