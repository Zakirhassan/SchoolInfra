import { useState, useEffect } from 'react';
import { MdAdd, MdFileDownload, MdUpload, MdEdit, MdDelete } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Breadcrumb from '../components/Breadcrumb';
import ExcelUpload from '../components/ExcelUpload';

export default function Students() {
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [editingId, setEditingId] = useState(null); // Track which student is being edited
    const [uploadMode, setUploadMode] = useState('create'); // default to create
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
            if (editingId) {
                await api.put(`/students/${editingId}`, formData);
                toast.success('Student updated successfully!');
            } else {
                await api.post('/students', formData);
                toast.success('Student added successfully!');
            }
            fetchStudents();
            setShowAddModal(false);
            resetForm();
            setEditingId(null);
        } catch (error) {
            toast.error(error.response?.data?.error || 'Operation failed');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this student?')) {
            try {
                await api.delete(`/students/${id}`);
                fetchStudents();
                toast.success('Student deleted successfully!');
            } catch (error) {
                toast.error('Failed to delete student');
            }
        }
    };

    const handleEdit = (student) => {
        setEditingId(student.id);
        setFormData({
            admissionNumber: student.admission_number,
            rollNumber: student.roll_number,
            fullName: student.full_name,
            fatherName: student.father_name,
            motherName: student.mother_name,
            dateOfBirth: student.date_of_birth ? new Date(student.date_of_birth).toISOString().split('T')[0] : '',
            gender: student.gender,
            classId: student.class_id,
            address: student.address,
            phoneNumber: student.phone_number,
            feeStatus: student.fee_status
        });
        setShowAddModal(true);
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
            toast.success('Template downloaded successfully!');
        } catch (error) {
            toast.error('Failed to download template');
        }
    };

    // Simplified: Just one download function for blank template
    const downloadBlankTemplate = async () => {
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
            toast.success('Template downloaded successfully!');
        } catch (error) {
            toast.error('Failed to download template');
        }
    };

    const handleUploadSuccess = () => {
        fetchStudents();
        setShowUploadModal(false);
    };

    const openUploadModal = () => {
        setUploadMode('create');
        setShowUploadModal(true);
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
            <Breadcrumb items={[{ label: 'Students' }]} />

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Students Management</h1>
                    <p className="text-gray-600">Manage students, download template, and bulk upload</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={downloadBlankTemplate}
                        className="btn btn-primary"
                    >
                        <MdFileDownload size={20} />
                        Download Template
                    </button>
                    <button
                        onClick={openUploadModal}
                        className="btn btn-success"
                    >
                        <MdUpload size={20} />
                        Upload Template
                    </button>
                    <button
                        onClick={() => {
                            setEditingId(null);
                            resetForm();
                            setShowAddModal(true);
                        }}
                        className="btn btn-secondary"
                    >
                        <MdAdd size={20} />
                        Add Student
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
                                    <td className="px-4 py-3 flex gap-2">
                                        <button onClick={() => handleEdit(student)} className="text-blue-600 hover:text-blue-800" title="Edit">
                                            <MdEdit size={20} />
                                        </button>
                                        <button onClick={() => handleDelete(student.id)} className="text-red-600 hover:text-red-800" title="Delete">
                                            <MdDelete size={20} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="modal-overlay">
                    <div className="modal-content max-w-2xl">
                        <div className="p-6 border-b">
                            <h2 className="text-2xl font-bold text-gray-800">
                                {uploadMode === 'create' ? 'Upload New Students' : 'Upload Student Updates'}
                            </h2>
                            <p className="text-sm text-gray-600 mt-2">
                                {uploadMode === 'create'
                                    ? 'Upload Excel file with new student data'
                                    : 'Upload Excel file with updated student data'}
                            </p>
                        </div>

                        <div className="p-6">
                            <ExcelUpload
                                classId={filterClass}
                                onSuccess={handleUploadSuccess}
                                mode={uploadMode}
                            />
                        </div>

                        <div className="p-6 border-t flex justify-end">
                            <button onClick={() => setShowUploadModal(false)} className="btn btn-secondary">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Student Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-bold mb-4">{editingId ? 'Edit Student' : 'Add New Student'}</h2>
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
