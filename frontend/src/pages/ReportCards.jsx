import { MdAdd, MdEdit, MdDelete, MdSave, MdFileDownload, MdAssessment, MdPublish, MdUnpublished } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Breadcrumb from '../components/Breadcrumb';
import { useState, useEffect } from 'react';

export default function ReportCards() {
    const [activeTab, setActiveTab] = useState('enter-marks'); // 'exams', 'enter-marks', 'generate'
    const [classes, setClasses] = useState([]);
    const [exams, setExams] = useState([]);
    const [students, setStudents] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [marks, setMarks] = useState({});
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedExam, setSelectedExam] = useState('');
    const [selectedStudent, setSelectedStudent] = useState('');
    const [loading, setLoading] = useState(false);
    const [showExamModal, setShowExamModal] = useState(false);
    const [examFormData, setExamFormData] = useState({
        examName: '',
        academicYear: '2025-2026',
        examDate: '',
        weightage: 100
    });

    useEffect(() => {
        fetchClasses();
    }, []);

    useEffect(() => {
        if (selectedClass) {
            fetchExams();
            fetchStudents();
            fetchSubjects();
        }
    }, [selectedClass]);

    useEffect(() => {
        if (selectedClass && selectedExam) {
            fetchMarks();
        }
    }, [selectedClass, selectedExam]);

    const fetchClasses = async () => {
        try {
            const response = await api.get('/classes');
            setClasses(response.data);
        } catch (error) {
            toast.error('Failed to fetch classes');
        }
    };

    const fetchExams = async () => {
        try {
            const response = await api.get(`/subjects/exams?classId=${selectedClass}`);
            setExams(response.data);
        } catch (error) {
            toast.error('Failed to fetch exams');
        }
    };

    const fetchStudents = async () => {
        try {
            const response = await api.get(`/students?classId=${selectedClass}`);
            setStudents(response.data);
        } catch (error) {
            toast.error('Failed to fetch students');
        }
    };

    const fetchSubjects = async () => {
        try {
            const response = await api.get(`/subjects?classId=${selectedClass}`);
            setSubjects(response.data);
        } catch (error) {
            toast.error('Failed to fetch subjects');
        }
    };

    const fetchMarks = async () => {
        try {
            const response = await api.get(`/subjects/marks?classId=${selectedClass}&examId=${selectedExam}`);
            const marksData = {};
            response.data.forEach(mark => {
                const key = `${mark.student_id}-${mark.subject_id}`;
                marksData[key] = mark.marks_obtained;
            });
            setMarks(marksData);
        } catch (error) {
            console.error('Failed to fetch marks');
        }
    };

    const handleCreateExam = async (e) => {
        e.preventDefault();
        try {
            await api.post('/subjects/exams', {
                examName: examFormData.examName,
                classId: selectedClass,
                academicYear: examFormData.academicYear,
                examDate: examFormData.examDate,
                weightage: parseInt(examFormData.weightage)
            });
            toast.success('Exam created successfully!');
            fetchExams();
            setShowExamModal(false);
            setExamFormData({ examName: '', academicYear: '2025-2026', examDate: '', weightage: 100 });
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to create exam');
        }
    };

    const handleDeleteExam = async (examId) => {
        if (window.confirm('Are you sure you want to delete this exam? All associated marks will be deleted.')) {
            try {
                await api.delete(`/subjects/exams/${examId}`);
                toast.success('Exam deleted successfully!');
                fetchExams();
            } catch (error) {
                toast.error('Failed to delete exam');
            }
        }
    };

    const handleMarkChange = (studentId, subjectId, value) => {
        const key = `${studentId}-${subjectId}`;
        setMarks(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleSaveMarks = async () => {
        if (!selectedExam) {
            toast.error('Please select an exam first');
            return;
        }

        setLoading(true);
        try {
            const marksArray = [];
            Object.keys(marks).forEach(key => {
                const [studentId, subjectId] = key.split('-');
                if (marks[key] !== '' && marks[key] !== null) {
                    marksArray.push({
                        studentId: parseInt(studentId),
                        subjectId: parseInt(subjectId),
                        examId: parseInt(selectedExam),
                        marksObtained: parseInt(marks[key])
                    });
                }
            });

            await api.post('/subjects/marks', { marks: marksArray });
            toast.success('Marks saved successfully!');
            fetchMarks();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to save marks');
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async (studentId, isPublished) => {
        try {
            await api.post('/reports/publish', { studentId, isPublished });
            toast.success(`Certificate ${isPublished ? 'published' : 'hidden'} successfully!`);
            fetchStudents(); // Refresh results to show new status
        } catch (error) {
            toast.error('Failed to update publication status');
        }
    };

    const handlePublishAll = async (isPublished) => {
        if (!selectedClass) return;
        if (!window.confirm(`Are you sure you want to ${isPublished ? 'publish' : 'hide'} all certificates for this course?`)) return;

        try {
            await api.post('/reports/publish/course', { courseId: selectedClass, isPublished });
            toast.success(`All certificates ${isPublished ? 'published' : 'hidden'} successfully!`);
            fetchStudents();
        } catch (error) {
            toast.error('Failed to update publication status');
        }
    };

    const handleMarkAllAlumni = async () => {
        if (!selectedClass) return;
        if (!window.confirm('Are you sure you want to mark ALL students in this course as Alumni? This should only be done after the course is fully completed.')) return;

        try {
            await api.patch(`/students/bulk-status/course/${selectedClass}`, { status: 'ALUMNI' });
            toast.success('Successfully marked all students as alumni');
            fetchStudents();
        } catch (error) {
            toast.error('Failed to update students');
        }
    };

    const generateReportCard = async () => {
        if (!selectedStudent || !selectedExam) {
            toast.error('Please select both student and exam');
            return;
        }

        setLoading(true);
        try {
            const response = await api.get(
                `/reports/student/${selectedStudent}/exam/${selectedExam}`,
                { responseType: 'blob' }
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const student = students.find(s => s.id === parseInt(selectedStudent));
            link.setAttribute('download', `report_card_${student?.full_name}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.success('Report card generated successfully!');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to generate report card');
        } finally {
            setLoading(false);
        }
    };

    const getSubjectMaxMarks = (subjectId) => {
        const subject = subjects.find(s => s.id === subjectId);
        return subject?.max_marks || 100;
    };

    return (
        <div className="fade-in">
            <Breadcrumb items={[{ label: 'Certificates' }]} />

            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Certificate Management</h1>
                <p className="text-gray-600">Manage assessments, enter marks, and publish certificates</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('exams')}
                    className={`px-6 py-3 font-medium transition-all ${activeTab === 'exams'
                        ? 'border-b-2 border-primary-600 text-primary-600'
                        : 'text-gray-600 hover:text-gray-800'
                        }`}
                >
                    <MdAssessment className="inline mr-2" />
                    Manage Exams
                </button>
                <button
                    onClick={() => setActiveTab('enter-marks')}
                    className={`px-6 py-3 font-medium transition-all ${activeTab === 'enter-marks'
                        ? 'border-b-2 border-primary-600 text-primary-600'
                        : 'text-gray-600 hover:text-gray-800'
                        }`}
                >
                    <MdEdit className="inline mr-2" />
                    Enter Marks
                </button>
                <button
                    onClick={() => setActiveTab('generate')}
                    className={`px-6 py-3 font-medium transition-all ${activeTab === 'generate'
                        ? 'border-b-2 border-primary-600 text-primary-600'
                        : 'text-gray-600 hover:text-gray-800'
                        }`}
                >
                    <MdFileDownload className="inline mr-2" />
                    Publish & Generate
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'exams' && (
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Select Course</label>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="input-field w-64"
                            >
                                <option value="">Select Course</option>
                                {classes.map(cls => (
                                    <option key={cls.id} value={cls.id}>
                                        {cls.class_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={() => setShowExamModal(true)}
                            disabled={!selectedClass}
                            className="btn btn-primary"
                        >
                            <MdAdd size={20} />
                            Create Exam
                        </button>
                    </div>

                    {selectedClass && (
                        <div className="grid-auto-fill">
                            {exams.map(exam => (
                                <div key={exam.id} className="card p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-800">{exam.exam_name}</h3>
                                            <p className="text-sm text-gray-600">{exam.academic_year}</p>
                                            {exam.exam_date && (
                                                <p className="text-sm text-gray-600">
                                                    Date: {new Date(exam.exam_date).toLocaleDateString()}
                                                </p>
                                            )}
                                            <p className="text-sm font-bold text-primary-600 mt-1">Weightage: {exam.weightage}%</p>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteExam(exam.id)}
                                            className="text-red-600 hover:text-red-800"
                                        >
                                            <MdDelete size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {exams.length === 0 && (
                                <div className="col-span-full text-center py-12 text-gray-500">
                                    No exams found. Create your first exam to get started.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'enter-marks' && (
                <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Select Class</label>
                            <select
                                value={selectedClass}
                                onChange={(e) => {
                                    setSelectedClass(e.target.value);
                                    setSelectedExam('');
                                }}
                                className="input-field"
                            >
                                <option value="">Select Course</option>
                                {classes.map(cls => (
                                    <option key={cls.id} value={cls.id}>
                                        {cls.class_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Select Exam</label>
                            <select
                                value={selectedExam}
                                onChange={(e) => setSelectedExam(e.target.value)}
                                className="input-field"
                                disabled={!selectedClass}
                            >
                                <option value="">Select Exam</option>
                                {exams.map(exam => (
                                    <option key={exam.id} value={exam.id}>
                                        {exam.exam_name} ({exam.academic_year})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {selectedClass && selectedExam && subjects.length > 0 && students.length > 0 && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-800">
                                    Marks Entry - {students.length} Students, {subjects.length} Subjects
                                </h3>
                                <button
                                    onClick={handleSaveMarks}
                                    disabled={loading}
                                    className="btn btn-success"
                                >
                                    <MdSave size={20} />
                                    {loading ? 'Saving...' : 'Save All Marks'}
                                </button>
                            </div>

                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th className="sticky left-0 bg-primary-600 z-10">Student Name</th>
                                            <th>Roll No.</th>
                                            {subjects.map(subject => (
                                                <th key={subject.id}>
                                                    {subject.subject_name}
                                                    <br />
                                                    <span className="text-xs font-normal">(Max: {subject.max_marks})</span>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map(student => (
                                            <tr key={student.id}>
                                                <td className="sticky left-0 bg-white font-medium">{student.full_name}</td>
                                                <td>{student.roll_number}</td>
                                                {subjects.map(subject => (
                                                    <td key={subject.id}>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={subject.max_marks}
                                                            value={marks[`${student.id}-${subject.id}`] || ''}
                                                            onChange={(e) => handleMarkChange(student.id, subject.id, e.target.value)}
                                                            className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {selectedClass && selectedExam && (subjects.length === 0 || students.length === 0) && (
                        <div className="card p-12 text-center">
                            <p className="text-gray-600">
                                {subjects.length === 0 && 'No subjects found for this class. Please add subjects first.'}
                                {students.length === 0 && 'No students found in this class. Please add students first.'}
                            </p>
                        </div>
                    )}

                    {(!selectedClass || !selectedExam) && (
                        <div className="card p-12 text-center">
                            <MdAssessment size={64} className="mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-600">Select a course and assessment to start entering marks</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'generate' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="card p-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4">Course & Assessment Selection</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Course</label>
                                    <select
                                        value={selectedClass}
                                        onChange={(e) => {
                                            setSelectedClass(e.target.value);
                                            setSelectedExam('');
                                            setSelectedStudent('');
                                        }}
                                        className="input-field"
                                    >
                                        <option value="">Select Course</option>
                                        {classes.map(cls => (
                                            <option key={cls.id} value={cls.id}>{cls.class_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Assessment</label>
                                    <select
                                        value={selectedExam}
                                        onChange={(e) => setSelectedExam(e.target.value)}
                                        className="input-field"
                                        disabled={!selectedClass}
                                    >
                                        <option value="">Select Assessment</option>
                                        {exams.map(exam => (
                                            <option key={exam.id} value={exam.id}>{exam.exam_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            {selectedClass && (
                                <div className="mt-4 flex gap-3">
                                    <button
                                        onClick={() => handlePublishAll(true)}
                                        className="btn bg-green-600 text-white hover:bg-green-700"
                                    >
                                        <MdPublish size={20} />
                                        Publish All
                                    </button>
                                    <button
                                        onClick={() => handlePublishAll(false)}
                                        className="btn bg-gray-600 text-white hover:bg-gray-700"
                                    >
                                        <MdUnpublished size={20} />
                                        Hide All
                                    </button>
                                    <button
                                        onClick={handleMarkAllAlumni}
                                        className="btn bg-amber-600 text-white hover:bg-amber-700"
                                    >
                                        Mark all as Alumni
                                    </button>
                                </div>
                            )}
                        </div>

                        {selectedClass && selectedExam && (
                            <div className="card p-6">
                                <h2 className="text-xl font-bold text-gray-800 mb-4">Student Certificates</h2>
                                <div className="space-y-3">
                                    {students.map(student => (
                                        <div key={student.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 transition">
                                            <div>
                                                <p className="font-bold text-gray-800">{student.full_name}</p>
                                                <p className="text-xs text-gray-500">Adm: {student.admission_number}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handlePublish(student.id, !student.is_published)}
                                                    className={`btn p-2 rounded-lg transition-all ${student.is_published ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                                    title={student.is_published ? "Unpublish" : "Publish"}
                                                >
                                                    {student.is_published ? <MdPublish size={20} /> : <MdUnpublished size={20} />}
                                                    <span className="text-xs font-bold ml-1">{student.is_published ? 'Published' : 'Hidden'}</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedStudent(student.id);
                                                        generateReportCard();
                                                    }}
                                                    className="btn btn-secondary py-2"
                                                >
                                                    <MdFileDownload size={18} />
                                                    Download
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-1">
                        <div className="card p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
                            <h2 className="text-xl font-bold mb-4">Certificate Info</h2>
                            <ul className="space-y-3 text-sm opacity-90">
                                <li className="flex items-center gap-2"><MdSave /> Data-driven certificates</li>
                                <li className="flex items-center gap-2"><MdSave /> Professional ASDC Layout</li>
                                <li className="flex items-center gap-2"><MdSave /> Grade-based evaluation</li>
                                <li className="flex items-center gap-2"><MdSave /> Direct Student Access</li>
                            </ul>
                            <div className="mt-6 p-4 bg-white/10 rounded-xl">
                                <p className="text-xs font-medium mb-3">Publishing Guide:</p>
                                <p className="text-xs leading-relaxed opacity-80">
                                    Clicking <b>Publish</b> makes the certificate instantly available on the Student's Dashboard. Hidden certificates cannot be viewed or downloaded by students.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Exam Modal */}
            {showExamModal && (
                <div className="modal-overlay">
                    <div className="modal-content max-w-md">
                        <div className="p-6 border-b">
                            <h2 className="text-2xl font-bold text-gray-800">Create New Exam</h2>
                        </div>

                        <form onSubmit={handleCreateExam} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Exam Name</label>
                                    <input
                                        type="text"
                                        value={examFormData.examName}
                                        onChange={(e) => setExamFormData({ ...examFormData, examName: e.target.value })}
                                        className="input-field"
                                        placeholder="e.g., Mid-term Exam"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
                                    <input
                                        type="text"
                                        value={examFormData.academicYear}
                                        onChange={(e) => setExamFormData({ ...examFormData, academicYear: e.target.value })}
                                        className="input-field"
                                        placeholder="e.g., 2025-2026"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Exam Date (Optional)</label>
                                    <input
                                        type="date"
                                        value={examFormData.examDate}
                                        onChange={(e) => setExamFormData({ ...examFormData, examDate: e.target.value })}
                                        className="input-field"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Weightage (%)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={examFormData.weightage}
                                        onChange={(e) => setExamFormData({ ...examFormData, weightage: e.target.value })}
                                        className="input-field"
                                        placeholder="e.g., 20"
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Total weightage for all exams in a course must be 100%.</p>
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end mt-6">
                                <button type="button" onClick={() => setShowExamModal(false)} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Create Exam
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
