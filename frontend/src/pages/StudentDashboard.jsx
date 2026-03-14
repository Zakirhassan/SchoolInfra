import { useState, useEffect } from 'react';
import { MdPerson, MdSchool, MdEventAvailable, MdDescription, MdFileDownload, MdLock } from 'react-icons/md';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function StudentDashboard() {
    const { user } = useAuth();
    const [studentData, setStudentData] = useState(null);
    const [attendance, setAttendance] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [availableCertificates, setAvailableCertificates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewDocUrl, setViewDocUrl] = useState(null);

    useEffect(() => {
        if (user?.id) {
            fetchDashboardData();
        }
    }, [user]);

    const fetchDashboardData = async () => {
        try {
            // Get student profile
            const profileRes = await api.get(`/students/${user.id}`);
            setStudentData(profileRes.data);

            // Get attendance stats
            const attendanceRes = await api.get(`/attendance/student/${user.id}`);
            setAttendance(attendanceRes.data);

            // Get documents
            const docsRes = await api.get(`/students/${user.id}/documents`);
            setDocuments(docsRes.data);

            // Get available (published) certificates
            // Fetch exams for their course
            const examsRes = await api.get(`/subjects/exams?classId=${profileRes.data.class_id}`);
            setAvailableCertificates(examsRes.data);

        } catch (error) {
            console.error('Dashboard fetch error:', error);
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const downloadCertificate = async (examId) => {
        try {
            const response = await api.get(`/reports/student/${user.id}/exam/${examId}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Certificate_${examId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Certificate not yet published');
        }
    };

    const downloadIDCard = async () => {
        try {
            const response = await api.get(`/idcards/student/${user.id}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `ID_Card_${studentData?.admission_number}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('ID Card downloaded successfully!');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to download ID card');
        }
    };


    if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><div className="spinner"></div></div>;

    return (
        <div className="fade-in max-w-6xl mx-auto">
            <div className="flex items-center gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="w-20 h-20 bg-primary-100 rounded-2xl flex items-center justify-center text-primary-600 overflow-hidden border-2 border-primary-200">
                    {studentData?.photo_url ? (
                        <img
                            src={`${api.defaults.baseURL.replace('/api', '')}${studentData.photo_url}`}
                            alt="Profile"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <MdPerson size={48} />
                    )}
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Welcome, {studentData?.full_name}</h1>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 font-medium mt-1">
                        <span className="bg-primary-50 text-primary-700 px-2 py-0.5 rounded-md">{studentData?.class_name}</span>
                        <span className="flex items-center gap-1">Admn: <b className="text-gray-700">{studentData?.admission_number}</b></span>
                        <span className="flex items-center gap-1">Roll: <b className="text-gray-700">{studentData?.roll_number}</b></span>
                        <span className="flex items-center gap-1">Father: <b className="text-gray-700">{studentData?.father_name}</b></span>
                        {studentData?.enrollment_status === 'ALUMNI' && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-wider">Alumni</span>
                        )}
                        {studentData?.enrollment_status === 'ENTRANCE_EXAM' && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full uppercase tracking-wider">Prospective</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Attendance Card */}
                <div className="card p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold opacity-90">Attendance</h2>
                        <MdEventAvailable size={24} />
                    </div>
                    <div className="text-4xl font-bold mb-2">{attendance?.percentage || 0}%</div>
                    <p className="text-sm opacity-80">{attendance?.present_days} days present out of {attendance?.total_days} total</p>
                    <div className="mt-4 w-full bg-white/20 rounded-full h-2">
                        <div className="bg-white h-2 rounded-full" style={{ width: `${attendance?.percentage || 0}%` }}></div>
                    </div>
                </div>

                {/* Course Details Card */}
                <div className="card p-6 border-l-4 border-emerald-500">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-800">Enrollment</h2>
                        <MdSchool className="text-emerald-500" size={24} />
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-gray-600">Admission No: <span className="font-semibold text-gray-800">{studentData?.admission_number}</span></p>
                        <p className="text-sm text-gray-600">Course Name: <span className="font-semibold text-gray-800">{studentData?.class_name}</span></p>
                        <p className="text-sm text-gray-600">Admission Date: <span className="font-semibold text-gray-800">{new Date(studentData?.created_at).toLocaleDateString()}</span></p>
                        <button
                            onClick={downloadIDCard}
                            className="btn btn-primary py-2 px-4 text-sm mt-3 w-full flex items-center justify-center gap-2"
                        >
                            <MdFileDownload size={18} />
                            Download ID Card
                        </button>
                    </div>
                </div>

                {/* Credentials Security */}
                <div className="card p-6 border-l-4 border-amber-500">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-800">Account Status</h2>
                        <MdLock className="text-amber-500" size={24} />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm text-gray-600">Email: <span className="font-medium text-gray-800">{studentData?.email}</span></p>
                        <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded mt-2">To update your password or profile information, please contact the center administrator.</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Certificates Section */}
                <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <MdDescription className="text-primary-600" />
                        Course Certificates
                    </h3>
                    <div className="space-y-4">
                        {!studentData?.is_published ? (
                            <div className="card p-8 text-center text-gray-500">
                                <MdLock size={48} className="mx-auto text-amber-300 mb-4 opacity-50" />
                                <p>Certificates are currently being processed.</p>
                                <p className="text-xs mt-2">They will appear here once published by the center administrator.</p>
                            </div>
                        ) : availableCertificates.length === 0 ? (
                            <div className="card p-8 text-center text-gray-500">No assessments scheduled yet.</div>
                        ) : (
                            availableCertificates.map((exam) => (
                                <div key={exam.id} className="card p-4 hover:shadow-md transition border-gray-100 flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-gray-800">{exam.exam_name}</p>
                                        <p className="text-xs text-gray-500">{exam.academic_year}</p>
                                    </div>
                                    <button
                                        onClick={() => downloadCertificate(exam.id)}
                                        className="btn btn-primary py-2 px-4 text-sm"
                                    >
                                        <MdFileDownload size={18} />
                                        Download
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Uploaded Documents */}
                <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <MdDescription className="text-secondary-600" />
                        My Uploaded Documents
                    </h3>
                    <div className="space-y-4">
                        {documents.length === 0 ? (
                            <div className="card p-8 text-center text-gray-500">No documents found in center records.</div>
                        ) : (
                            documents.map((doc) => (
                                <div key={doc.id} className="card p-4 flex items-center justify-between border-dashed border-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
                                            <MdDescription size={20} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-800">{doc.document_name}</p>
                                            <p className="text-xs text-gray-500">Verified by Admin</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setViewDocUrl(doc.document_url)}
                                        className="text-primary-600 hover:text-primary-800 text-sm font-bold"
                                    >
                                        View
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

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
