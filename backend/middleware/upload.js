import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage for student photos
const photoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const photosDir = path.join(uploadDir, 'photos');
        if (!fs.existsSync(photosDir)) {
            fs.mkdirSync(photosDir, { recursive: true });
        }
        cb(null, photosDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'student-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Configure storage for Excel files
const excelStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const excelDir = path.join(uploadDir, 'excel');
        if (!fs.existsSync(excelDir)) {
            fs.mkdirSync(excelDir, { recursive: true });
        }
        cb(null, excelDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'upload-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter for images
const imageFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only JPEG, JPG, and PNG images are allowed'));
    }
};

// File filter for Excel
const excelFilter = (req, file, cb) => {
    const allowedTypes = /xlsx|xls/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    if (extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
};

// Multer upload configurations
export const uploadPhoto = multer({
    storage: photoStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: imageFilter
});

export const uploadExcel = multer({
    storage: excelStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: excelFilter
});
