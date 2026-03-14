import { useState, useEffect } from 'react';
import { MdHistory, MdPerson, MdLabel, MdAccessTime, MdInfo } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Breadcrumb from '../components/Breadcrumb';

export default function AuditLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            const res = await api.get('/audit');
            setLogs(res.data);
        } catch (error) {
            toast.error('Failed to fetch audit logs');
        } finally {
            setLoading(false);
        }
    };

    const getActionBadgeClass = (action) => {
        if (action.includes('CREATE')) return 'bg-green-100 text-green-700 border-green-200';
        if (action.includes('UPDATE')) return 'bg-blue-100 text-blue-700 border-blue-200';
        if (action.includes('DELETE')) return 'bg-red-100 text-red-700 border-red-200';
        if (action.includes('UPLOAD')) return 'bg-purple-100 text-purple-700 border-purple-200';
        return 'bg-gray-100 text-gray-700 border-gray-200';
    };

    const formatDetails = (details) => {
        if (!details) return '-';
        if (typeof details === 'string') {
            try {
                const parsed = JSON.parse(details);
                return Object.entries(parsed).map(([key, val]) => `${key}: ${val}`).join(', ');
            } catch (e) {
                return details;
            }
        }
        return JSON.stringify(details);
    };

    if (loading) {
        return <div className="flex justify-center items-center min-h-[60vh]"><div className="spinner"></div></div>;
    }

    return (
        <div className="fade-in">
            <Breadcrumb items={[{ label: 'Audit Logs' }]} />

            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Audit Logs</h1>
                <p className="text-gray-600">Track administrative and teacher activities across the system</p>
            </div>

            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b">
                                <th className="p-4 font-semibold text-gray-600">Action</th>
                                <th className="p-4 font-semibold text-gray-600">Performer</th>
                                <th className="p-4 font-semibold text-gray-600">Details</th>
                                <th className="p-4 font-semibold text-gray-600">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getActionBadgeClass(log.action)}`}>
                                            {log.action.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1 rounded bg-opacity-10 ${log.user_role === 'ADMIN' ? 'bg-indigo-600 text-indigo-600' : 'bg-orange-600 text-orange-600'}`}>
                                                <MdPerson size={16} />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-800 leading-tight">{log.performer_name}</p>
                                                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{log.user_role}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-start gap-2 max-w-md">
                                            <MdInfo className="text-gray-300 mt-0.5 flex-shrink-0" size={16} />
                                            <p className="text-sm text-gray-600 italic">
                                                {formatDetails(log.details)}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col text-sm text-gray-500">
                                            <span className="font-medium text-gray-700">{new Date(log.timestamp).toLocaleDateString()}</span>
                                            <span className="text-xs">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {logs.length === 0 && (
                    <div className="p-12 text-center text-gray-500">
                        <MdHistory size={64} className="mx-auto text-gray-200 mb-4" />
                        <p>No audit logs available yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
