import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MdPeople, MdSchool, MdAttachMoney, MdTrendingUp, MdAdd, MdFileDownload, MdAssessment } from 'react-icons/md';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../api/axios';
import Breadcrumb from '../components/Breadcrumb';

export default function Dashboard() {
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalClasses: 0,
        paidFees: 0,
        unpaidFees: 0,
        partialFees: 0,
        maleStudents: 0,
        femaleStudents: 0
    });
    const [classDistribution, setClassDistribution] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const [studentsRes, classesRes] = await Promise.all([
                api.get('/students'),
                api.get('/classes')
            ]);

            const students = studentsRes.data;
            const classes = classesRes.data;

            // Calculate statistics
            const stats = {
                totalStudents: students.length,
                totalClasses: classes.length,
                paidFees: students.filter(s => s.fee_status === 'Paid').length,
                unpaidFees: students.filter(s => s.fee_status === 'Unpaid').length,
                partialFees: students.filter(s => s.fee_status === 'Partial').length,
                maleStudents: students.filter(s => s.gender === 'Male').length,
                femaleStudents: students.filter(s => s.gender === 'Female').length
            };

            setStats(stats);

            // Class distribution
            const distribution = classes.map(cls => ({
                name: `${cls.class_name}-${cls.section}`,
                students: students.filter(s => s.class_id === cls.id).length
            })).filter(d => d.students > 0);

            setClassDistribution(distribution);
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        {
            title: 'Total Students',
            value: stats.totalStudents,
            icon: MdPeople,
            color: 'from-blue-500 to-blue-600',
            bgColor: 'bg-blue-500',
            link: '/students'
        },
        {
            title: 'Total Classes',
            value: stats.totalClasses,
            icon: MdSchool,
            color: 'from-purple-500 to-purple-600',
            bgColor: 'bg-purple-500',
            link: '/classes'
        },
        {
            title: 'Fees Collected',
            value: stats.paidFees,
            icon: MdAttachMoney,
            color: 'from-green-500 to-green-600',
            bgColor: 'bg-green-500',
            link: '/fees'
        },
        {
            title: 'Pending Fees',
            value: stats.unpaidFees + stats.partialFees,
            icon: MdTrendingUp,
            color: 'from-orange-500 to-orange-600',
            bgColor: 'bg-orange-500',
            link: '/fees'
        },
    ];

    const genderData = [
        { name: 'Male', value: stats.maleStudents, color: '#3b82f6' },
        { name: 'Female', value: stats.femaleStudents, color: '#ec4899' },
    ];

    const feeData = [
        { name: 'Paid', value: stats.paidFees, color: '#10b981' },
        { name: 'Unpaid', value: stats.unpaidFees, color: '#ef4444' },
        { name: 'Partial', value: stats.partialFees, color: '#f59e0b' },
    ];

    const quickActions = [
        { title: 'Add Student', icon: MdAdd, link: '/students', color: 'bg-blue-500' },
        { title: 'Generate ID Cards', icon: MdAssessment, link: '/id-cards', color: 'bg-purple-500' },
        { title: 'Report Cards', icon: MdAssessment, link: '/report-cards', color: 'bg-green-500' },
        { title: 'Export Data', icon: MdFileDownload, link: '/export', color: 'bg-orange-500' },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="fade-in">
            <Breadcrumb items={[{ label: 'Dashboard' }]} />

            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Dashboard</h1>
                <p className="text-gray-600">Welcome back! Here's an overview of Advance Skill Development Center.</p>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {statCards.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <Link key={index} to={stat.link}>
                            <div className={`stat-card bg-gradient-to-br ${stat.color} text-white cursor-pointer hover:shadow-strong transition-all duration-300`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`${stat.bgColor} bg-opacity-20 p-3 rounded-lg`}>
                                        <Icon size={28} />
                                    </div>
                                    <div className="text-3xl font-bold">{stat.value}</div>
                                </div>
                                <div className="text-sm font-medium opacity-90">{stat.title}</div>
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Class Distribution */}
                <div className="card p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Class-wise Students</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={classDistribution}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="students" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Gender Distribution */}
                <div className="card p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Gender Distribution</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={genderData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {genderData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Fee Status Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="card p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Fee Collection Status</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={feeData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, value }) => `${name}: ${value}`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {feeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Quick Actions */}
                <div className="card p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {quickActions.map((action, index) => {
                            const Icon = action.icon;
                            return (
                                <Link key={index} to={action.link}>
                                    <div className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:shadow-md transition-all cursor-pointer">
                                        <div className={`${action.color} w-12 h-12 rounded-lg flex items-center justify-center text-white mb-3`}>
                                            <Icon size={24} />
                                        </div>
                                        <p className="text-sm font-semibold text-gray-800">{action.title}</p>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
