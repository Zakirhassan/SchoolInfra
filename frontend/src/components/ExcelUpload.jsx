import { useState, useRef } from 'react';
import { MdCloudUpload, MdCheckCircle, MdError } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function ExcelUpload({ classId, onSuccess }) {
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef(null);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleFile = async (file) => {
        // Validate file type
        const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
        if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            toast.error('Please upload a valid Excel file (.xlsx or .xls)');
            return;
        }

        if (!classId) {
            toast.error('Please select a class first');
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('classId', classId);

        try {
            // Simulate progress
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => Math.min(prev + 10, 90));
            }, 200);

            const response = await api.post('/students/bulk-upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            clearInterval(progressInterval);
            setUploadProgress(100);

            toast.success(`Successfully uploaded ${response.data.count} students!`);

            if (onSuccess) {
                onSuccess();
            }

            // Reset after success
            setTimeout(() => {
                setUploading(false);
                setUploadProgress(0);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }, 1500);

        } catch (error) {
            setUploading(false);
            setUploadProgress(0);

            if (error.response?.data?.details) {
                const errors = error.response.data.details;
                toast.error(
                    <div>
                        <p className="font-semibold">Upload failed with {errors.length} error(s):</p>
                        <ul className="mt-2 text-sm">
                            {errors.slice(0, 3).map((err, idx) => (
                                <li key={idx}>• {err}</li>
                            ))}
                            {errors.length > 3 && <li>• ... and {errors.length - 3} more</li>}
                        </ul>
                    </div>,
                    { duration: 6000 }
                );
            } else {
                toast.error(error.response?.data?.error || 'Failed to upload file');
            }
        }
    };

    const onButtonClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div>
            <form
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`dropzone ${dragActive ? 'active' : ''} ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleChange}
                    className="hidden"
                    disabled={uploading}
                />

                {!uploading ? (
                    <div className="text-center">
                        <MdCloudUpload size={64} className="mx-auto text-primary-500 mb-4" />
                        <p className="text-lg font-semibold text-gray-700 mb-2">
                            {dragActive ? 'Drop your file here' : 'Drag and drop your Excel file here'}
                        </p>
                        <p className="text-sm text-gray-500 mb-4">or</p>
                        <button
                            type="button"
                            onClick={onButtonClick}
                            className="btn btn-primary"
                            disabled={uploading}
                        >
                            Browse Files
                        </button>
                        <p className="text-xs text-gray-500 mt-4">Supported formats: .xlsx, .xls</p>
                    </div>
                ) : (
                    <div className="text-center">
                        <div className="mb-4">
                            {uploadProgress < 100 ? (
                                <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                            ) : (
                                <MdCheckCircle size={64} className="mx-auto text-green-500" />
                            )}
                        </div>
                        <p className="text-lg font-semibold text-gray-700 mb-2">
                            {uploadProgress < 100 ? 'Uploading...' : 'Upload Complete!'}
                        </p>
                        <div className="w-full max-w-xs mx-auto bg-gray-200 rounded-full h-2 mb-2">
                            <div
                                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                            ></div>
                        </div>
                        <p className="text-sm text-gray-600">{uploadProgress}%</p>
                    </div>
                )}
            </form>
        </div>
    );
}
