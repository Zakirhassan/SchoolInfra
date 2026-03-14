# Quick Start Guide

## Prerequisites Check
- [ ] Node.js installed (v16+)
- [ ] PostgreSQL installed and running
- [ ] Git (optional, for version control)

## Setup Steps

### 1. Database Setup

```bash
# Create database
createdb school_management

# Or using psql
psql -U postgres
CREATE DATABASE school_management;
\q
```

### 2. Initialize Database

```bash
cd backend
node init-db.js
```

This will:
- Create all necessary tables
- Set up indexes
- Create default admin account (username: `admin`, password: `admin123`)
- Insert sample class data

### 3. Start Backend

```bash
# In backend directory
npm run dev
```

You should see:
```
✓ Connected to PostgreSQL database
🚀 Server running on port 5000
📍 Environment: development
```

### 4. Start Frontend

```bash
# In frontend directory (new terminal)
npm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### 5. Access Application

1. Open browser: `http://localhost:5173`
2. Login with:
   - Username: `admin`
   - Password: `admin123`

## Common Issues

### Port 5000 already in use
```bash
# Change PORT in backend/.env
PORT=5000

# Update frontend/vite.config.js proxy target
target: 'http://localhost:5000'
```

### Database connection refused
```bash
# Check PostgreSQL is running
# Windows:
services.msc  # Look for PostgreSQL service

# Verify credentials in backend/.env
DB_USER=postgres
DB_PASSWORD=your_password
```

### npm install fails
```bash
# Clear cache and retry
npm cache clean --force
npm install
```

## Next Steps

After successful setup:
1. Change default admin password
2. Add students manually or via Excel upload
3. Configure school information in backend/.env
4. Explore all features!

## Need Help?

Check the main README.md for detailed documentation.
