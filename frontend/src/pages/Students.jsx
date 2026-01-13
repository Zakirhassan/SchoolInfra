import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function Students() {
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [formData, setFormData] = useState({
        admissionNumber: '',
        rollNumber: '',
        fullName: '',
        fatherName: '',
        motherName: '',
        dateOfBirth: '',
        gender: 'Male',
        classId: '',
        address: '',
        phoneNumber: '',
        feeStatus: 'Unpaid'
    });

    useEffect(() => {
        fetchStudents();
        fetchClasses();
    }, []);

    const fetchStudents = async () => {
        try {
            const response = await api.get('/students');
            setStudents(response.data);
        } catch (error) {
            console.error('Failed to fetch students:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchClasses = async () => {
        try {
            const response = await api.get('/classes');
            setClasses(response.data);
        } catch (error) {
            console.error('Failed to fetch classes:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/students', formData);
            fetchStudents();
            setShowAddModal(false);
            resetForm();
            alert('Student added successfully!');
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to add student');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this student?')) {
            try {
                await api.delete(`/students/${id}`);
                fetchStudents();
                alert('Student deleted successfully!');
            } catch (error) {
                alert('Failed to delete student');
            }
        }
    };

    const resetForm = () => {
        setFormData({
            admissionNumber: '',
            rollNumber: '',
            fullName: '',
            fatherName: '',
            motherName: '',
            dateOfBirth: '',
            gender: 'Male',
            classId: '',
            address: '',
            phoneNumber: '',
            feeStatus: 'Unpaid'
        });
    };

    const downloadTemplate = async () => {
        try {
            const response = await api.get('/students/template/download', {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'student_upload_template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            alert('Failed to download template');
        }
    };

    const filteredStudents = students.filter(student => {
        const matchesSearch = student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.admission_number.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesClass = !filterClass || student.class_id === parseInt(filterClass);
        return matchesSearch && matchesClass;
    });

    if (loading) {
        return <div className="flex justify-center items-center min-h-[60vh]"><div className="spinner"></div></div>;
    }

    return (
        <div className="fade-in">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Students Management</h1>
                <div className="flex gap-3">
                    <button onClick={downloadTemplate} className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition btn">
                        📥 Download Template
                    </button>
                    <button onClick={() => setShowAddModal(true)} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition btn">
                        ➕ Add Student
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                        type="text"
                        placeholder="Search by name or admission number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                        value={filterClass}
                        onChange={(e) => setFilterClass(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Classes</option>
                        {classes.map(cls => (
                            <option key={cls.id} value={cls.id}>{cls.class_name}-{cls.section}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Students Table */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className="px-4 py-3 text-left">Adm No</th>
                                <th className="px-4 py-3 text-left">Name</th>
                                <th className="px-4 py-3 text-left">Class</th>
                                <th className="px-4 py-3 text-left">Roll No</th>
                                <th className="px-4 py-3 text-left">Father Name</th>
                                <th className="px-4 py-3 text-left">Phone</th>
                                <th className="px-4 py-3 text-left">Fee Status</th>
                                <th className="px-4 py-3 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.map(student => (
                                <tr key={student.id}>
                                    <td className="px-4 py-3">{student.admission_number}</td>
                                    <td className="px-4 py-3 font-medium">{student.full_name}</td>
                                    <td className="px-4 py-3">{student.class_name}-{student.section}</td>
                                    <td className="px-4 py-3">{student.roll_number}</td>
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
                                        <button onClick={() => handleDelete(student.id)} className="text-red-600 hover:text-red-800">
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Student Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-bold mb-4">Add New Student</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="text"
                                    placeholder="Admission Number"
                                    value={formData.admissionNumber}
                                    onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })}
                                    className="px-4 py-2 border rounded-lg"
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="Roll Number"
                                    value={formData.rollNumber}
                                    onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                                    className="px-4 py-2 border rounded-lg"
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="Full Name"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                    className="px-4 py-2 border rounded-lg col-span-2"
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="Father Name"
                                    value={formData.fatherName}
                                    onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                                    className="px-4 py-2 border rounded-lg"
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="Mother Name"
                                    value={formData.motherName}
                                    onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                                    className="px-4 py-2 border rounded-lg"
                                    required
                                />
                                <input
                                    type="date"
                                    value={formData.dateOfBirth}
                                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                                    className="px-4 py-2 border rounded-lg"
                                    required
                                />
                                <select
                                    value={formData.gender}
                                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                    className="px-4 py-2 border rounded-lg"
                                >
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                                <select
                                    value={formData.classId}
                                    onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                                    className="px-4 py-2 border rounded-lg col-span-2"
                                    required
                                >
                                    <option value="">Select Class</option>
                                    {classes.map(cls => (
                                        <option key={cls.id} value={cls.id}>{cls.class_name}-{cls.section}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    placeholder="Phone Number"
                                    value={formData.phoneNumber}
                                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                    className="px-4 py-2 border rounded-lg col-span-2"
                                    required
                                />
                                <textarea
                                    placeholder="Address"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="px-4 py-2 border rounded-lg col-span-2"
                                    rows="3"
                                    required
                                />
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg">
                                    Cancel
                                </button>
                                <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                                    Add Student
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
