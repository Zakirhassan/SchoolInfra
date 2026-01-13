import { useState, useEffect } from 'react';
import { MdAdd, MdEdit, MdDelete, MdPeople, MdBook } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Breadcrumb from '../components/Breadcrumb';

export default function Classes() {
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showSubjectModal, setShowSubjectModal] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [selectedClassForSubjects, setSelectedClassForSubjects] = useState(null);
    const [formData, setFormData] = useState({
        className: '',
        section: '',
        monthlyFee: ''
    });
    const [subjectFormData, setSubjectFormData] = useState({
        subjectName: '',
        maxMarks: '100'
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [classesRes, studentsRes, subjectsRes] = await Promise.all([
                api.get('/classes'),
                api.get('/students'),
                api.get('/subjects')
            ]);
            setClasses(classesRes.data);
            setStudents(studentsRes.data);
            setSubjects(subjectsRes.data);
        } catch (error) {
            toast.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingClass) {
                await api.put(`/classes/${editingClass.id}`, formData);
                toast.success('Class updated successfully!');
            } else {
                await api.post('/classes', formData);
                toast.success('Class created successfully!');
            }
            fetchData();
            handleCloseModal();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to save class');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this class?')) {
            try {
                await api.delete(`/classes/${id}`);
                toast.success('Class deleted successfully!');
                fetchData();
            } catch (error) {
                toast.error('Failed to delete class');
            }
        }
    };

    const handleEdit = (cls) => {
        setEditingClass(cls);
        setFormData({
            className: cls.class_name,
            section: cls.section,
            monthlyFee: cls.monthly_fee
        });
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingClass(null);
        setFormData({ className: '', section: '', monthlyFee: '' });
    };

    const handleManageSubjects = (cls) => {
        setSelectedClassForSubjects(cls);
        setShowSubjectModal(true);
    };

    const handleAddSubject = async (e) => {
        e.preventDefault();
        try {
            await api.post('/subjects', {
                subjectName: subjectFormData.subjectName,
                classId: selectedClassForSubjects.id,
                maxMarks: subjectFormData.maxMarks
            });
            toast.success('Subject added successfully!');
            fetchData();
            setSubjectFormData({ subjectName: '', maxMarks: '100' });
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to add subject');
        }
    };

    const handleDeleteSubject = async (subjectId) => {
        if (window.confirm('Are you sure you want to delete this subject?')) {
            try {
                await api.delete(`/subjects/${subjectId}`);
                toast.success('Subject deleted successfully!');
                fetchData();
            } catch (error) {
                toast.error('Failed to delete subject');
            }
        }
    };

    const getStudentCount = (classId) => {
        return students.filter(s => s.class_id === classId).length;
    };

    const getSubjectCount = (classId) => {
        return subjects.filter(s => s.class_id === classId).length;
    };

    const getClassSubjects = (classId) => {
        return subjects.filter(s => s.class_id === classId);
    };

    if (loading) {
        return <div className="flex justify-center items-center min-h-[60vh]"><div className="spinner"></div></div>;
    }

    return (
        <div className="fade-in">
            <Breadcrumb items={[{ label: 'Classes' }]} />

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Class Management</h1>
                    <p className="text-gray-600">Manage classes, sections, and subjects</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn btn-primary">
                    <MdAdd size={20} />
                    Add Class
                </button>
            </div>

            {/* Classes Grid */}
            <div className="grid-auto-fill">
                {classes.map((cls) => (
                    <div key={cls.id} className="card p-6 hover:shadow-strong transition-all">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-800">
                                    {cls.class_name}-{cls.section}
                                </h3>
                                <p className="text-sm text-gray-600">Class {cls.class_name}, Section {cls.section}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(cls)} className="text-blue-600 hover:text-blue-800">
                                    <MdEdit size={20} />
                                </button>
                                <button onClick={() => handleDelete(cls.id)} className="text-red-600 hover:text-red-800">
                                    <MdDelete size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3 mb-4">
                            <div className="flex items-center gap-2 text-gray-700">
                                <MdPeople className="text-primary-600" size={20} />
                                <span className="font-medium">{getStudentCount(cls.id)} Students</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-700">
                                <MdBook className="text-purple-600" size={20} />
                                <span className="font-medium">{getSubjectCount(cls.id)} Subjects</span>
                            </div>
                            <div className="text-gray-700">
                                <span className="font-semibold">Monthly Fee:</span> ₹{cls.monthly_fee}
                            </div>
                        </div>

                        <button
                            onClick={() => handleManageSubjects(cls)}
                            className="w-full btn btn-secondary text-sm"
                        >
                            <MdBook size={18} />
                            Manage Subjects
                        </button>
                    </div>
                ))}
            </div>

            {classes.length === 0 && (
                <div className="card p-12 text-center">
                    <MdSchool size={64} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-600">No classes found. Create your first class to get started.</p>
                </div>
            )}

            {/* Add/Edit Class Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="p-6 border-b">
                            <h2 className="text-2xl font-bold text-gray-800">
                                {editingClass ? 'Edit Class' : 'Add New Class'}
                            </h2>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Class Name</label>
                                    <input
                                        type="text"
                                        value={formData.className}
                                        onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                                        className="input-field"
                                        placeholder="e.g., 10"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
                                    <input
                                        type="text"
                                        value={formData.section}
                                        onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                                        className="input-field"
                                        placeholder="e.g., A"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Fee (₹)</label>
                                    <input
                                        type="number"
                                        value={formData.monthlyFee}
                                        onChange={(e) => setFormData({ ...formData, monthlyFee: e.target.value })}
                                        className="input-field"
                                        placeholder="e.g., 3000"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end mt-6">
                                <button type="button" onClick={handleCloseModal} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingClass ? 'Update Class' : 'Create Class'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Manage Subjects Modal */}
            {showSubjectModal && selectedClassForSubjects && (
                <div className="modal-overlay">
                    <div className="modal-content max-w-3xl">
                        <div className="p-6 border-b">
                            <h2 className="text-2xl font-bold text-gray-800">
                                Manage Subjects - Class {selectedClassForSubjects.class_name}-{selectedClassForSubjects.section}
                            </h2>
                        </div>

                        <div className="p-6">
                            {/* Add Subject Form */}
                            <form onSubmit={handleAddSubject} className="mb-6 p-4 bg-gray-50 rounded-lg">
                                <h3 className="font-semibold text-gray-800 mb-3">Add New Subject</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input
                                        type="text"
                                        value={subjectFormData.subjectName}
                                        onChange={(e) => setSubjectFormData({ ...subjectFormData, subjectName: e.target.value })}
                                        className="input-field"
                                        placeholder="Subject Name"
                                        required
                                    />
                                    <input
                                        type="number"
                                        value={subjectFormData.maxMarks}
                                        onChange={(e) => setSubjectFormData({ ...subjectFormData, maxMarks: e.target.value })}
                                        className="input-field"
                                        placeholder="Max Marks"
                                        required
                                    />
                                    <button type="submit" className="btn btn-primary">
                                        <MdAdd size={18} />
                                        Add Subject
                                    </button>
                                </div>
                            </form>

                            {/* Subjects List */}
                            <div>
                                <h3 className="font-semibold text-gray-800 mb-3">Current Subjects</h3>
                                {getClassSubjects(selectedClassForSubjects.id).length > 0 ? (
                                    <div className="space-y-2">
                                        {getClassSubjects(selectedClassForSubjects.id).map((subject) => (
                                            <div key={subject.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                                                <div>
                                                    <span className="font-medium text-gray-800">{subject.subject_name}</span>
                                                    <span className="text-sm text-gray-600 ml-3">Max Marks: {subject.max_marks}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteSubject(subject.id)}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    <MdDelete size={20} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-600 text-center py-4">No subjects added yet.</p>
                                )}
                            </div>

                            <div className="flex justify-end mt-6">
                                <button onClick={() => setShowSubjectModal(false)} className="btn btn-secondary">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
