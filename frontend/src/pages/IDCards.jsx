import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function IDCards() {
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
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

    const generateBulkIDCards = async () => {
        if (!selectedClass) {
            alert('Please select a class');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/idcards/bulk',
                { classId: selectedClass },
                { responseType: 'blob' }
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'id_cards_bulk.pdf');
            document.body.appendChild(link);
            link.click();
            link.remove();

            alert('ID cards generated successfully!');
        } catch (error) {
            alert('Failed to generate ID cards');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fade-in">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">ID Card Generation</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bulk Generation */}
                <div className="card p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">🆔 Bulk ID Card Generation</h2>
                    <p className="text-gray-600 mb-4">Generate ID cards for all students in a class</p>

                    <div className="space-y-4">
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Select Class</option>
                            {classes.map(cls => (
                                <option key={cls.id} value={cls.id}>
                                    {cls.class_name}-{cls.section}
                                </option>
                            ))}
                        </select>

                        <button
                            onClick={generateBulkIDCards}
                            disabled={loading || !selectedClass}
                            className="w-full bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 transition btn disabled:opacity-50"
                        >
                            {loading ? 'Generating...' : '📥 Generate ID Cards'}
                        </button>
                    </div>
                </div>

                {/* Info Card */}
                <div className="card p-6 bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                    <h2 className="text-xl font-bold mb-4">ℹ️ ID Card Information</h2>
                    <ul className="space-y-2 text-sm">
                        <li>✓ ID cards are generated in PDF format</li>
                        <li>✓ Multiple cards per A4 page (8 cards)</li>
                        <li>✓ Includes student photo, name, class, roll number</li>
                        <li>✓ Ready for printing</li>
                        <li>✓ Professional design with school branding</li>
                    </ul>
                </div>
            </div>

            {/* Preview Section */}
            <div className="card p-6 mt-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">ID Card Preview</h2>
                <div className="bg-gradient-to-br from-blue-800 to-purple-800 p-4 rounded-lg inline-block">
                    <div className="bg-blue-600 text-white text-center py-2 px-4 rounded-t-lg">
                        <div className="font-bold">ABC SCHOOL</div>
                        <div className="text-xs">STUDENT ID CARD</div>
                    </div>
                    <div className="bg-white p-4 rounded-b-lg flex gap-4">
                        <div className="w-16 h-20 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">
                            PHOTO
                        </div>
                        <div className="text-sm">
                            <div className="font-bold text-gray-800">STUDENT NAME</div>
                            <div className="text-gray-600">Class: 10-A</div>
                            <div className="text-gray-600">Roll No: 15</div>
                            <div className="text-gray-600">Adm No: ADM001</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
