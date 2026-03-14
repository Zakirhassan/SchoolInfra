import { useState, useEffect } from 'react';
import { MdCloudUpload, MdFileDownload, MdEventAvailable } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Breadcrumb from '../components/Breadcrumb';
import * as XLSX from 'xlsx';

export default function Attendance() {
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendanceData, setAttendanceData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchCourses();
    }, []);

    useEffect(() => {
        if (selectedCourse) {
            fetchAttendanceStats();
        }
    }, [selectedCourse]);

    const fetchCourses = async () => {
        try {
            const response = await api.get('/classes');
            setCourses(response.data);
        } catch (error) {
            console.error('Failed to fetch courses:', error);
        }
    };

    const fetchAttendanceStats = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/attendance/stats/${selectedCourse}`);
            setAttendanceData(response.data);
        } catch (error) {
            toast.error('Failed to fetch attendance stats');
        } finally {
            setLoading(false);
        }
    };

    const downloadTemplate = () => {
        if (!selectedCourse) {
            toast.error('Please select a course first');
            return;
        }

        // Generate template with current students in the course
        const studentInfo = attendanceData.map(s => ({
            'Admission Number': s.admission_number,
            'Student Name': s.full_name,
            'Status': 'Present' // Default status
        }));

        const ws = XLSX.utils.json_to_sheet(studentInfo);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
        XLSX.writeFile(wb, `Attendance_Template_${selectedDate}.xlsx`);
        toast.success('Template downloaded');
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedCourse) {
            if (!selectedCourse) toast.error('Please select a course');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('courseId', selectedCourse);
        formData.append('date', selectedDate);

        setUploading(true);
        try {
            const response = await api.post('/attendance/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success(response.data.message);
            fetchAttendanceStats();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Upload failed');
        } finally {
            setUploading(false);
            e.target.value = null;
        }
    };

    return (
        <div className="fade-in">
            <Breadcrumb items={[{ label: 'Attendance' }]} />

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Attendance Management</h1>
                    <p className="text-gray-600">Upload daily attendance and monitor student performance</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                <div className="lg:col-span-3">
                    <div className="card p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Course</label>
                                <select
                                    value={selectedCourse}
                                    onChange={(e) => setSelectedCourse(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Choose a course...</option>
                                    {courses.map(course => (
                                        <option key={course.id} value={course.id}>{course.class_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Attendance Date</label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex items-end gap-2">
                                <button
                                    onClick={downloadTemplate}
                                    className="btn btn-secondary flex-1"
                                    disabled={!selectedCourse}
                                >
                                    <MdFileDownload size={18} />
                                    Template
                                </button>
                                <label className={`btn btn-primary flex-1 cursor-pointer ${uploading || !selectedCourse ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <MdCloudUpload size={18} />
                                    {uploading ? 'Uploading...' : 'Upload Excel'}
                                    <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx,.xls" disabled={uploading || !selectedCourse} />
                                </label>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-12"><div className="spinner"></div></div>
                        ) : selectedCourse ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="px-4 py-3 text-left">Adm No</th>
                                            <th className="px-4 py-3 text-left">Student Name</th>
                                            <th className="px-4 py-3 text-center">Total Days</th>
                                            <th className="px-4 py-3 text-center">Present</th>
                                            <th className="px-4 py-3 text-center">Percentage</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {attendanceData.map((record) => (
                                            <tr key={record.student_id}>
                                                <td className="px-4 py-3 text-sm text-gray-600">{record.admission_number}</td>
                                                <td className="px-4 py-3 font-medium text-gray-800">{record.full_name}</td>
                                                <td className="px-4 py-3 text-center">{record.total_days}</td>
                                                <td className="px-4 py-3 text-center">{record.present_days}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <div className="w-16 bg-gray-200 rounded-full h-1.5 hidden sm:block">
                                                            <div
                                                                className={`h-1.5 rounded-full ${parseFloat(record.percentage) < 75 ? 'bg-red-500' : 'bg-green-500'}`}
                                                                style={{ width: `${record.percentage}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className={`font-bold ${parseFloat(record.percentage) < 75 ? 'text-red-600' : 'text-green-600'}`}>
                                                            {record.percentage || 0}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                <MdEventAvailable size={48} className="mx-auto mb-4 opacity-20" />
                                <p>Select a course to view attendance statistics</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <div className="card p-6 bg-blue-50 border-blue-100">
                        <h3 className="font-bold text-blue-900 mb-4">Instructions</h3>
                        <ul className="text-sm text-blue-800 space-y-3 list-disc pl-4">
                            <li>Select a <b>Course</b> and <b>Date</b>.</li>
                            <li>Download the <b>Template</b> to get current student list.</li>
                            <li>Mark "Present" or "Absent" in the Status column.</li>
                            <li>Upload the file to update records.</li>
                            <li>Students with less than <b>75%</b> attendance are marked in red.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
