import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function Fees() {
    const [students, setStudents] = useState([]);
    const [filterStatus, setFilterStatus] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStudents();
    }, [filterStatus]);

    const fetchStudents = async () => {
        try {
            const params = filterStatus ? `?feeStatus=${filterStatus}` : '';
            const response = await api.get(`/students${params}`);
            setStudents(response.data);
        } catch (error) {
            console.error('Failed to fetch students:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateFeeStatus = async (studentId, newStatus) => {
        try {
            await api.put(`/fees/status/${studentId}`, { feeStatus: newStatus });
            fetchStudents();
            alert('Fee status updated successfully!');
        } catch (error) {
            alert('Failed to update fee status');
        }
    };

    const stats = {
        total: students.length,
        paid: students.filter(s => s.fee_status === 'Paid').length,
        unpaid: students.filter(s => s.fee_status === 'Unpaid').length,
        partial: students.filter(s => s.fee_status === 'Partial').length
    };

    if (loading) {
        return <div className="flex justify-center items-center min-h-[60vh]"><div className="spinner"></div></div>;
    }

    return (
        <div className="fade-in">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Fee Management</h1>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="card p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-sm">Total Students</div>
                </div>
                <div className="card p-4 bg-gradient-to-br from-green-500 to-green-600 text-white">
                    <div className="text-2xl font-bold">{stats.paid}</div>
                    <div className="text-sm">Fees Paid</div>
                </div>
                <div className="card p-4 bg-gradient-to-br from-red-500 to-red-600 text-white">
                    <div className="text-2xl font-bold">{stats.unpaid}</div>
                    <div className="text-sm">Fees Unpaid</div>
                </div>
                <div className="card p-4 bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
                    <div className="text-2xl font-bold">{stats.partial}</div>
                    <div className="text-sm">Partial Payment</div>
                </div>
            </div>

            {/* Filter */}
            <div className="card p-4 mb-6">
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All Status</option>
                    <option value="Paid">Paid</option>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Partial">Partial</option>
                </select>
            </div>

            {/* Students Table */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className="px-4 py-3 text-left">Admission No</th>
                                <th className="px-4 py-3 text-left">Name</th>
                                <th className="px-4 py-3 text-left">Class</th>
                                <th className="px-4 py-3 text-left">Father Name</th>
                                <th className="px-4 py-3 text-left">Phone</th>
                                <th className="px-4 py-3 text-left">Fee Status</th>
                                <th className="px-4 py-3 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map(student => (
                                <tr key={student.id}>
                                    <td className="px-4 py-3">{student.admission_number}</td>
                                    <td className="px-4 py-3 font-medium">{student.full_name}</td>
                                    <td className="px-4 py-3">{student.class_name}-{student.section}</td>
                                    <td className="px-4 py-3">{student.father_name}</td>
                                    <td className="px-4 py-3">{student.phone_number}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-sm ${student.fee_status === 'Paid' ? 'bg-green-100 text-green-800' :
                                                student.fee_status === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-red-100 text-red-800'
                                            }`}>
                                            {student.fee_status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <select
                                            value={student.fee_status}
                                            onChange={(e) => updateFeeStatus(student.id, e.target.value)}
                                            className="px-2 py-1 border rounded text-sm"
                                        >
                                            <option value="Paid">Paid</option>
                                            <option value="Unpaid">Unpaid</option>
                                            <option value="Partial">Partial</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
