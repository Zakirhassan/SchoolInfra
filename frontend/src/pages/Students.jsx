import { useState, useEffect } from 'react';
import { MdAdd, MdFileDownload, MdUpload, MdEdit, MdDelete, MdDescription, MdCloudUpload, MdPerson, MdImage } from 'react-icons/md';
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
    const [filterStatus, setFilterStatus] = useState('ACTIVE'); // Default to Active

    const [showAddModal, setShowAddModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showDocsModal, setShowDocsModal] = useState(false);
    const [viewDocUrl, setViewDocUrl] = useState(null);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [editingId, setEditingId] = useState(null); // Track which student is being edited
    const [photo, setPhoto] = useState(null);
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
        feeStatus: 'Unpaid',
        email: '',
        password: '',
        enrollment_status: 'ENTRANCE_EXAM'
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

    console.log("kkkkkkkkkkkk", viewDocUrl)

    const handleSubmit = async (e) => {
        e.preventDefault();
        const data = new FormData();
        Object.keys(formData).forEach(key => data.append(key, formData[key]));
        if (photo) data.append('photo', photo);

        try {
            if (editingId) {
                await api.put(`/students/${editingId}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Student updated successfully!');
            } else {
                await api.post('/students', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
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
        const dob = student.date_of_birth ? new Date(student.date_of_birth) : null;
        setFormData({
            admissionNumber: student.admission_number,
            rollNumber: student.roll_number,
            fullName: student.full_name,
            fatherName: student.father_name,
            motherName: student.mother_name,
            dateOfBirth: dob ? new Date(dob.getTime() - dob.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '',
            gender: student.gender,
            classId: student.class_id,
            address: student.address,
            phoneNumber: student.phone_number,
            feeStatus: student.fee_status,
            email: student.email || '',
            password: '',
            photoUrl: student.photo_url,
            enrollmentStatus: student.enrollment_status || 'ACTIVE'
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
            feeStatus: 'Unpaid',
            email: '',
            password: '',
            enrollmentStatus: 'ENTRANCE_EXAM'
        });
        setPhoto(null);
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

    const handleViewDocs = async (student) => {
        setSelectedStudent(student);
        setShowDocsModal(true);
        fetchDocuments(student.id);
    };

    const fetchDocuments = async (studentId) => {
        try {
            const response = await api.get(`/students/${studentId}/documents`);
            setDocuments(response.data);
        } catch (error) {
            console.error('Failed to fetch documents:', error);
            toast.error('Failed to fetch documents');
        }
    };

    const handleDocUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const docName = prompt('Enter document name (e.g., ID Proof, Qualification):', file.name);
        if (docName === null) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentName', docName);

        setUploadingDoc(true);
        try {
            await api.post(`/students/${selectedStudent.id}/documents`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Document uploaded successfully');
            fetchDocuments(selectedStudent.id);
        } catch (error) {
            toast.error('Upload failed');
        } finally {
            setUploadingDoc(false);
        }
    };

    const handleDocDelete = async (docId) => {
        if (!window.confirm('Delete this document?')) return;
        try {
            await api.delete(`/students/documents/${docId}`);
            toast.success('Document deleted');
            fetchDocuments(selectedStudent.id);
        } catch (error) {
            toast.error('Delete failed');
        }
    };

    const filteredStudents = students.filter(student => {
        const matchesSearch = student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.admission_number.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesClass = !filterClass || student.class_id === parseInt(filterClass);
        const matchesStatus = filterStatus === 'ALL' || student.enrollment_status === filterStatus;
        return matchesSearch && matchesClass && matchesStatus;
    });

    const handleUpdateStatus = async (studentId, status) => {
        try {
            await api.patch(`/students/${studentId}/status`, { status });
            toast.success(`Student status updated to ${status}`);
            fetchStudents();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };


    if (loading) {
        return <div className="flex justify-center items-center min-h-[60vh]"><div className="spinner"></div></div>;
    }

    return (
        <div className="fade-in">
            <Breadcrumb items={[{ label: 'Students' }]} />

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Students Management</h1>
                    <p className="text-gray-600">Register students, manage credentials, and course enrollments</p>
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
                        <option value="">All Courses</option>
                        {classes.map(cls => (
                            <option key={cls.id} value={cls.id}>{cls.class_name}</option>
                        ))}
                    </select>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="ACTIVE">Active Students</option>
                        <option value="ENTRANCE_EXAM">Entrance Exam</option>
                        <option value="ALUMNI">Alumni</option>
                        <option value="ALL">All Students</option>
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
                                <th className="px-4 py-3 text-left">Course</th>
                                <th className="px-4 py-3 text-left">Roll No</th>
                                <th className="px-4 py-3 text-left">Father Name</th>
                                <th className="px-4 py-3 text-left">Phone</th>
                                {/* <th className="px-4 py-3 text-left">Status</th> */}
                                {/* <th className="px-4 py-3 text-left">Fee</th> */}
                                <th className="px-4 py-3 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.map(student => (
                                <tr key={student.id}>
                                    <td className="px-4 py-3">{student.admission_number}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden border">
                                                {student.photo_url ? (
                                                    <img
                                                        src={student.photo_url}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <MdPerson size={18} className="text-gray-400" />
                                                )}
                                            </div>
                                            <span className="font-medium text-gray-900">{student.full_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">{student.class_name}</td>
                                    <td className="px-4 py-3">{student.roll_number}</td>
                                    <td className="px-4 py-3">{student.father_name}</td>
                                    <td className="px-4 py-3">{student.phone_number}</td>
                                    {/* <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${student.enrollment_status === 'ACTIVE' ? 'bg-blue-100 text-blue-700' :
                                            student.enrollment_status === 'ALUMNI' ? 'bg-amber-100 text-amber-700' :
                                                'bg-purple-100 text-purple-700'
                                            }`}>
                                            {student.enrollment_status?.replace('_', ' ')}
                                        </span>
                                    </td> */}
                                    {/* <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-sm ${student.fee_status === 'Paid' ? 'bg-green-100 text-green-800' :
                                            student.fee_status === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-red-100 text-red-800'
                                            }`}>
                                            {student.fee_status}
                                        </span>
                                    </td> */}
                                    <td className="px-4 py-3 flex gap-2 items-center">
                                        {student.enrollment_status === 'ALUMNI' ? (
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300">
                                                ALUMNI
                                            </span>
                                        ) : (
                                            <>
                                                {student.enrollment_status === 'ENTRANCE_EXAM' && (
                                                    <button
                                                        onClick={() => handleUpdateStatus(student.id, 'ACTIVE')}
                                                        className="btn btn-success py-1 px-3 text-xs"
                                                        title="Clear Entrance Exam"
                                                    >
                                                        Clear Exam
                                                    </button>
                                                )}
                                                {student.enrollment_status === 'ACTIVE' && (
                                                    <button
                                                        onClick={() => {
                                                            if (window.confirm('Mark this student as Alumni?')) {
                                                                handleUpdateStatus(student.id, 'ALUMNI');
                                                            }
                                                        }}
                                                        className="btn btn-primary py-1 px-3 text-xs bg-amber-600 hover:bg-amber-700 border-none"
                                                        title="Mark as Alumni"
                                                    >
                                                        Alumni
                                                    </button>
                                                )}
                                                <button onClick={() => handleViewDocs(student)} className="text-green-600 hover:text-green-800" title="Documents">
                                                    <MdDescription size={20} />
                                                </button>
                                                <button onClick={() => handleEdit(student)} className="text-blue-600 hover:text-blue-800" title="Edit">
                                                    <MdEdit size={20} />
                                                </button>
                                                <button onClick={() => handleDelete(student.id)} className="text-red-600 hover:text-red-800" title="Delete">
                                                    <MdDelete size={20} />
                                                </button>
                                            </>
                                        )}
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
                            <div className="flex justify-center mb-6">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                                        {photo ? (
                                            <img src={URL.createObjectURL(photo)} alt="Preview" className="w-full h-full object-cover" />
                                        ) : formData.photoUrl ? (
                                            <img src={`${api.defaults.baseURL.replace('/api', '')}${formData.photoUrl}`} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <MdImage size={40} className="text-gray-300" />
                                        )}
                                    </div>
                                    <label className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                                        <input type="file" className="hidden" onChange={(e) => setPhoto(e.target.files[0])} accept="image/*" />
                                        <span className="text-xs font-semibold">Update Photo</span>
                                    </label>
                                </div>
                            </div>

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
                                    <option value="">Select Course</option>
                                    {classes.map(cls => (
                                        <option key={cls.id} value={cls.id}>{cls.class_name}</option>
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
                                    rows="2"
                                    required
                                />
                                <div className="col-span-2 border-t pt-4 mt-2">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Student Login Credentials</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input
                                            type="email"
                                            placeholder="Student Email (for Login)"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="px-4 py-2 border rounded-lg"
                                            required={!editingId}
                                        />
                                        <input
                                            type="password"
                                            placeholder={editingId ? "New Password (leave blank to keep)" : "Password"}
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="px-4 py-2 border rounded-lg"
                                            required={!editingId}
                                        />
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Enrollment Status</label>
                                    <select
                                        value={formData.enrollmentStatus}
                                        onChange={(e) => setFormData({ ...formData, enrollmentStatus: e.target.value })}
                                        className="px-4 py-2 border rounded-lg w-full bg-gray-50 focus:bg-white transition-all shadow-sm"
                                    >
                                        <option value="ENTRANCE_EXAM">Entrance Exam</option>
                                        <option value="ACTIVE">Active</option>
                                        <option value="ALUMNI">Alumni</option>
                                    </select>
                                </div>
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
            {/* Documents Modal */}
            {showDocsModal && (
                <div className="modal-overlay">
                    <div className="modal-content max-w-2xl">
                        <div className="p-6 border-b flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800">Student Documents</h2>
                                <p className="text-sm text-gray-600 mt-1">{selectedStudent?.full_name} ({selectedStudent?.admission_number})</p>
                            </div>
                            <label className={`btn btn-primary cursor-pointer ${uploadingDoc ? 'opacity-50 pointer-events-none' : ''}`}>
                                <MdCloudUpload size={20} />
                                {uploadingDoc ? 'Uploading...' : 'Upload Doc'}
                                <input type="file" className="hidden" onChange={handleDocUpload} disabled={uploadingDoc} />
                            </label>
                        </div>
                        <div className="p-6">
                            {documents.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">No documents uploaded yet.</p>
                            ) : (
                                <div className="space-y-3">
                                    {documents.map((doc) => (
                                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition">
                                            <div className="flex items-center gap-3">
                                                <MdDescription className="text-blue-600" size={24} />
                                                <div>
                                                    <p className="font-medium text-gray-800">{doc.document_name}</p>
                                                    <p className="text-xs text-gray-500">{new Date(doc.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setViewDocUrl(doc.document_url)}
                                                    className="btn btn-secondary py-1 px-3 text-xs"
                                                >
                                                    View
                                                </button>
                                                <button
                                                    onClick={() => handleDocDelete(doc.id)}
                                                    className="text-red-600 hover:text-red-800 p-1"
                                                >
                                                    <MdDelete size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t flex justify-end">
                            <button onClick={() => setShowDocsModal(false)} className="btn btn-secondary">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Document Viewer Modal */}
            {viewDocUrl && (
                <div className="modal-overlay" onClick={() => setViewDocUrl(null)}>
                    <div className="modal-content max-w-5xl h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-800">Document Viewer</h2>
                            <button
                                onClick={() => setViewDocUrl(null)}
                                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                            >
                                ×
                            </button>
                        </div>
                        <div className="h-[calc(90vh-80px)]">
                            <iframe
                                src={viewDocUrl}
                                className="w-full h-full border-0"
                                title="Document Viewer"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
