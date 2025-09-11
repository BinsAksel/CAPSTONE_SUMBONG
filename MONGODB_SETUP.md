# MongoDB Setup for Credential Verification System

## Quick Setup (Windows)

### Option 1: Install MongoDB Community Edition
1. Download MongoDB Community Server from: https://www.mongodb.com/try/download/community
2. Install with default settings
3. MongoDB will run as a Windows service automatically

### Option 2: Use MongoDB Atlas (Cloud - No Local Installation)
1. Go to https://www.mongodb.com/atlas
2. Create free account and cluster
3. Get connection string and set environment variable:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/sumbong
   ```

### Option 3: Use Docker (if you have Docker installed)
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

## Testing the System

### 1. Start Backend Server
```bash
cd sumbong/backend
npm start
```

### 2. Test Backend Health
Open browser and go to: `http://localhost:5000/api/health`

You should see:
```json
{
  "status": "success",
  "message": "Server is running",
  "endpoints": {
    "test": "/api/test",
    "users": "/api/admin/users",
    "approveCredentials": "/api/admin/approve-credentials/:userId",
    "rejectCredentials": "/api/admin/reject-credentials/:userId"
  }
}
```

### 3. Test Database Connection
Go to: `http://localhost:5000/api/test`

### 4. Start Frontend
```bash
cd sumbong/frontend
npm start
```

### 5. Test Admin Login
- Go to: `http://localhost:3000/admin`
- Login: `admin@gmail.com` / `admin123`

## Troubleshooting

### Backend Won't Start
- Check if MongoDB is running
- Check console for connection errors
- Try the health endpoint: `/api/health`

### Database Connection Issues
- MongoDB not running locally
- Wrong connection string
- Firewall blocking port 27017

### Frontend Errors
- Backend not running
- CORS issues
- Check browser console for errors

## Current Status
The credential verification system is now properly implemented with:
- ✅ Backend API endpoints
- ✅ Frontend admin dashboard
- ✅ User verification status tracking
- ✅ Issue reporting system
- ✅ Real-time notifications
- ✅ Error handling and logging

Just need MongoDB running to test the full functionality!




