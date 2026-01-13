# School Management System

A comprehensive web-based School Management System for administrators to manage students, generate ID cards and report cards, track fees, and export data.

## 🚀 Features

- **Student Management**: Add, edit, delete, and search students
- **Excel Import/Export**: Bulk upload students via Excel and export filtered data
- **ID Card Generation**: Generate professional PDF ID cards (single or bulk)
- **Report Cards**: Create detailed report cards with marks, grades, and percentages
- **Fee Tracking**: Monitor and update student fee status
- **Authentication**: Secure admin login with JWT
- **Premium UI**: Modern, responsive design with glassmorphism and animations

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **PostgreSQL** (v12 or higher)
- **npm** or **yarn**

## 🛠️ Installation

### 1. Clone or Navigate to Project

```bash
cd C:\Users\zakir\.gemini\antigravity\scratch\school-management-system
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment variables
# Edit .env file with your database credentials
# Default values are already set for local development

# Initialize database
# Create a PostgreSQL database named 'school_management'
# Then run the schema.sql file
psql -U postgres -d school_management -f schema.sql
```

**Important**: Update the `.env` file with your PostgreSQL credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=school_management
DB_USER=postgres
DB_PASSWORD=your_password_here
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install
```

## 🏃 Running the Application

### Start Backend Server

```bash
cd backend
npm run dev
```

Backend will run on `http://localhost:5000`

### Start Frontend Development Server

```bash
cd frontend
npm run dev
```

Frontend will run on `http://localhost:5173`

## 🔐 Default Login Credentials

- **Username**: `admin`
- **Password**: `admin123`

**Note**: The default password hash in `schema.sql` needs to be generated. To create a new admin:

```javascript
// Run this in Node.js to generate password hash
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('admin123', 10);
console.log(hash);
```

Then update the INSERT statement in `schema.sql` with the generated hash.

## 📚 Usage Guide

### Adding Students

1. Navigate to **Students** page
2. Click **Add Student** button
3. Fill in all required fields
4. Submit the form

### Bulk Upload via Excel

1. Go to **Students** page
2. Click **Download Template** to get the Excel template
3. Fill the template with student data
4. Upload the completed Excel file
5. System will validate and import students

### Generating ID Cards

1. Navigate to **ID Cards** page
2. Select a class
3. Click **Generate ID Cards**
4. PDF will download automatically

### Creating Report Cards

1. Go to **Report Cards** page
2. Select class, exam, and student
3. Click **Generate Report Card**
4. Ensure marks have been entered beforehand

### Managing Fees

1. Navigate to **Fees** page
2. View fee status for all students
3. Update status using dropdown in Actions column
4. Filter by status to view specific groups

### Exporting Data

1. Go to **Export** page
2. Apply filters (class, fee status, gender)
3. Click **Export to Excel**
4. Excel file will download

## 🗂️ Project Structure

```
school-management-system/
├── backend/
│   ├── config/          # Database and auth configuration
│   ├── routes/          # API routes
│   ├── services/        # Business logic (PDF, Excel)
│   ├── middleware/      # Auth and upload middleware
│   ├── uploads/         # Uploaded files storage
│   ├── schema.sql       # Database schema
│   ├── .env             # Environment variables
│   └── server.js        # Express server
├── frontend/
│   ├── src/
│   │   ├── api/         # Axios configuration
│   │   ├── components/  # React components
│   │   ├── contexts/    # React contexts (Auth)
│   │   ├── pages/       # Page components
│   │   ├── App.jsx      # Main app component
│   │   └── main.jsx     # Entry point
│   ├── public/          # Static assets
│   └── index.html       # HTML template
└── README.md
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/change-password` - Change password

### Students
- `GET /api/students` - Get all students (with filters)
- `GET /api/students/:id` - Get student by ID
- `POST /api/students` - Create student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student
- `POST /api/students/bulk-upload` - Bulk upload via Excel
- `GET /api/students/template/download` - Download Excel template

### Classes
- `GET /api/classes` - Get all classes
- `POST /api/classes` - Create class
- `PUT /api/classes/:id` - Update class
- `DELETE /api/classes/:id` - Delete class

### Subjects & Exams
- `GET /api/subjects` - Get subjects
- `POST /api/subjects` - Create subject
- `GET /api/subjects/exams` - Get exams
- `POST /api/subjects/exams` - Create exam
- `POST /api/marks` - Enter/update marks

### Fees
- `GET /api/fees/student/:id` - Get fee history
- `POST /api/fees/payment` - Record payment
- `PUT /api/fees/status/:id` - Update fee status

### ID Cards
- `GET /api/idcards/student/:id` - Generate single ID card
- `POST /api/idcards/bulk` - Generate bulk ID cards

### Report Cards
- `GET /api/reports/student/:studentId/exam/:examId` - Generate report card

### Export
- `POST /api/export/students` - Export students to Excel

## 🎨 Technologies Used

### Backend
- **Express.js** - Web framework
- **PostgreSQL** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Multer** - File uploads
- **xlsx** - Excel processing
- **PDFKit** - PDF generation

### Frontend
- **React** - UI library
- **Vite** - Build tool
- **React Router** - Routing
- **Tailwind CSS** - Styling
- **Axios** - HTTP client

## 🚢 Deployment

### Backend (Railway)

1. Create account on [Railway](https://railway.app)
2. Create new project
3. Add PostgreSQL database
4. Deploy backend from GitHub or local
5. Set environment variables
6. Run database migrations

### Frontend (Vercel)

1. Create account on [Vercel](https://vercel.com)
2. Import frontend directory
3. Set build command: `npm run build`
4. Set output directory: `dist`
5. Add environment variable for API URL
6. Deploy

## 📝 Notes

- Default admin credentials should be changed in production
- Ensure PostgreSQL is running before starting backend
- File uploads are stored locally in `backend/uploads`
- For production, consider using cloud storage (AWS S3, etc.)
- PDF generation works on server-side, no client-side dependencies

## 🐛 Troubleshooting

### Database Connection Error
- Verify PostgreSQL is running
- Check database credentials in `.env`
- Ensure database `school_management` exists

### Port Already in Use
- Change PORT in backend `.env` file
- Update proxy in frontend `vite.config.js`

### Excel Upload Fails
- Check file format (.xlsx or .xls)
- Verify all required columns are present
- Check for duplicate admission numbers

## 📄 License

ISC

## 👥 Support

For issues or questions, please contact the system administrator.

---

**Built with ❤️ for ABC School**
