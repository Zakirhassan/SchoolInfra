import { useState, useEffect } from 'react';
import { MdAdd, MdEdit, MdDelete, MdEmail, MdPerson, MdImage } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Breadcrumb from '../components/Breadcrumb';

export default function Teachers() {
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState(null);
    const [photo, setPhoto] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        fullName: '',
        email: ''
    });

    useEffect(() => {
        fetchTeachers();
    }, []);

    const fetchTeachers = async () => {
        try {
            const res = await api.get('/teachers');
            setTeachers(res.data);
        } catch (error) {
            toast.error('Failed to fetch teachers');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const data = new FormData();
        Object.keys(formData).forEach(key => data.append(key, formData[key]));
        if (photo) data.append('photo', photo);

        try {
            if (editingTeacher) {
                await api.put(`/teachers/${editingTeacher.id}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Teacher updated successfully!');
            } else {
                await api.post('/teachers', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Teacher created successfully!');
            }
            fetchTeachers();
            handleCloseModal();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to save teacher');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this teacher?')) {
            try {
                await api.delete(`/teachers/${id}`);
                toast.success('Teacher deleted successfully!');
                fetchTeachers();
            } catch (error) {
                toast.error('Failed to delete teacher');
            }
        }
    };

    const handleEdit = (teacher) => {
        setEditingTeacher(teacher);
        setFormData({
            username: teacher.username,
            password: '', // Don't show password
            fullName: teacher.full_name,
            email: teacher.email
        });
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingTeacher(null);
        setFormData({ username: '', password: '', fullName: '', email: '' });
        setPhoto(null);
    };

    if (loading) {
        return <div className="flex justify-center items-center min-h-[60vh]"><div className="spinner"></div></div>;
    }

    return (
        <div className="fade-in">
            <Breadcrumb items={[{ label: 'Teachers' }]} />

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Teacher Management</h1>
                    <p className="text-gray-600">Register and manage teaching staff and their credentials</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn btn-primary">
                    <MdAdd size={20} />
                    Add Teacher
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teachers.map((teacher) => (
                    <div key={teacher.id} className="card p-6 overflow-hidden">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-16 h-16 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden border-2 border-primary-200">
                                {teacher.photo_url ? (
                                    <img
                                        src={`${teacher.photo_url}`}
                                        // src={`${import.meta.env.VITE_API_URL}${teacher.photo_url}`}
                                        alt={teacher.full_name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <MdPerson size={32} className="text-gray-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xl font-bold text-gray-800 truncate">{teacher.full_name}</h3>
                                <p className="text-sm text-gray-500 font-medium">@{teacher.username}</p>
                            </div>
                        </div>

                        <div className="space-y-2 mb-6">
                            <div className="flex items-center gap-2 text-gray-600 text-sm">
                                <MdEmail size={18} className="text-primary-500" />
                                <span className="truncate">{teacher.email}</span>
                            </div>
                            <div className="text-xs text-gray-400">
                                Joined: {new Date(teacher.created_at).toLocaleDateString()}
                            </div>
                        </div>

                        <div className="flex border-t pt-4 gap-2">
                            <button onClick={() => handleEdit(teacher)} className="flex-1 btn btn-secondary text-sm">
                                <MdEdit size={16} />
                                Edit
                            </button>
                            <button onClick={() => handleDelete(teacher.id)} className="btn btn-secondary text-red-600 hover:bg-red-50 text-sm">
                                <MdDelete size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {teachers.length === 0 && (
                <div className="card p-12 text-center text-gray-500">
                    <MdPerson size={64} className="mx-auto text-gray-200 mb-4" />
                    <p>No teachers registered yet.</p>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="p-6 border-b">
                            <h2 className="text-2xl font-bold text-gray-800">
                                {editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}
                            </h2>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="flex justify-center mb-6">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                                        {photo ? (
                                            <img src={URL.createObjectURL(photo)} alt="Preview" className="w-full h-full object-cover" />
                                        ) : editingTeacher?.photo_url ? (
                                            <img src={`${editingTeacher.photo_url}`} alt="Preview" className="w-full h-full object-cover" />
                                            // <img src={`${import.meta.env.VITE_API_URL}${editingTeacher.photo_url}`} alt="Preview" className="w-full h-full object-cover" />
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        className="input-field"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="input-field"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        className="input-field"
                                        required
                                        disabled={editingTeacher}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {editingTeacher ? 'New Password (Optional)' : 'Password'}
                                    </label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="input-field"
                                        required={!editingTeacher}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end mt-8">
                                <button type="button" onClick={handleCloseModal} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingTeacher ? 'Update Teacher' : 'Create Teacher'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
