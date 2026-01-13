import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function Export() {
    const [classes, setClasses] = useState([]);
    const [filters, setFilters] = useState({
        classId: '',
        feeStatus: '',
        gender: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            const response = await api.get('/classes');
            setClasses(response.data);
        } catch (error) {
            console.error('Failed to fetch classes:', error);
        }
    };

    const handleExport = async () => {
        setLoading(true);
        try {
            const response = await api.post('/export/students', filters, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'students_export.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();

            alert('Data exported successfully!');
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to export data');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fade-in">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Export Student Data</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Export Form */}
                <div className="card p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">📥 Export Filters</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Class (Optional)</label>
                            <select
                                value={filters.classId}
                                onChange={(e) => setFilters({ ...filters, classId: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">All Classes</option>
                                {classes.map(cls => (
                                    <option key={cls.id} value={cls.id}>
                                        {cls.class_name}-{cls.section}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Fee Status (Optional)</label>
                            <select
                                value={filters.feeStatus}
                                onChange={(e) => setFilters({ ...filters, feeStatus: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">All Status</option>
                                <option value="Paid">Paid</option>
                                <option value="Unpaid">Unpaid</option>
                                <option value="Partial">Partial</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Gender (Optional)</label>
                            <select
                                value={filters.gender}
                                onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">All Genders</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <button
                            onClick={handleExport}
                            disabled={loading}
                            className="w-full bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 transition btn disabled:opacity-50"
                        >
                            {loading ? 'Exporting...' : '📥 Export to Excel'}
                        </button>
                    </div>
                </div>

                {/* Info Card */}
                <div className="card p-6 bg-gradient-to-br from-orange-500 to-red-500 text-white">
                    <h2 className="text-xl font-bold mb-4">ℹ️ Export Information</h2>
                    <ul className="space-y-2 text-sm">
                        <li>✓ Export student data to Excel format</li>
                        <li>✓ Apply filters to export specific data</li>
                        <li>✓ Includes all student information</li>
                        <li>✓ Fee status clearly indicated</li>
                        <li>✓ Ready for further analysis</li>
                        <li>✓ Compatible with Excel and Google Sheets</li>
                    </ul>

                    <div className="mt-6 p-4 bg-white/20 rounded-lg">
                        <div className="text-sm font-medium mb-2">Exported Fields:</div>
                        <div className="text-xs space-y-1">
                            <div>• Admission Number</div>
                            <div>• Roll Number</div>
                            <div>• Full Name</div>
                            <div>• Father & Mother Name</div>
                            <div>• Date of Birth</div>
                            <div>• Gender</div>
                            <div>• Class & Section</div>
                            <div>• Address & Phone</div>
                            <div>• Fee Status</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tips */}
            <div className="card p-4 mt-6 bg-blue-50 border border-blue-200">
                <p className="text-blue-800">
                    <strong>💡 Tip:</strong> Leave filters empty to export all students. Use filters to export specific subsets of data.
                </p>
            </div>
        </div>
    );
}
