#!/bin/bash

# AMC Backend Deployment Script
# Run this on your AWS server after connecting via SSH

echo "========================================="
echo "AMC Backend Deployment Script"
echo "========================================="

# Update package.json to ensure all dependencies are available
echo "[1/6] Checking Node.js and npm..."
node --version
npm --version

# Navigate to the application directory (adjust if needed)
cd ~ 2>/dev/null || cd /home/ec2-user

# Check if PM2 is installed
echo "[2/6] Checking PM2..."
pm2 --version 2>/dev/null || npm install -g pm2

# Create a backup of the current deployment
echo "[3/6] Creating backup..."
if [ -d "amc-backend-backup" ]; then
    rm -rf amc-backend-backup
fi
if [ -d "Backend" ]; then
    mv Backend amc-backend-backup
fi

# Create new Backend directory
mkdir -p Backend
cd Backend

# Note: You would normally use git clone or scp to transfer files
# For now, this script assumes files will be copied via SCP or git

echo "[4/6] Files should be transferred now."
echo "Please transfer the following files/folders to this server:"
echo "  - package.json"
echo "  - server.js"
echo "  - routes/ (folder)"
echo "  - middleware/ (folder)"
echo "  - models/ (folder)"
echo "  - Frontend/ (folder)"
echo "  - config/ (folder)"
echo "  - services/ (folder)"
echo "  - utils/ (folder)"
echo "  - emailTemplates/ (folder)"

# Install dependencies
echo "[5/6] Installing dependencies..."
npm install

# Set environment variables (edit these for your setup)
echo "[6/6] Setting up environment variables..."
echo "Please create a .env file with:"
echo "  MONGODB_URI=your_mongodb_connection_string"
echo "  JWT_SECRET=your_jwt_secret"
echo "  NODE_ENV=production"
echo "  PORT=3000"

# Create .env file template
cat > .env << 'EOF'
# MongoDB Connection (Update with your Atlas connection string)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/amcDatabase

# JWT Secret (Use a strong random string)
JWT_SECRET=your_very_secure_jwt_secret_here

# Environment
NODE_ENV=production
PORT=3000

# Server URL
SERVER_URL=https://ec2-44-200-25-168.compute-1.amazonaws.com
EOF

# Start the application with PM2
echo "Starting application with PM2..."
pm2 delete all 2>/dev/null
pm2 start server.js --name amc-backend
pm2 save

# Show status
pm2 status

echo "========================================="
echo "Deployment complete!"
echo "========================================="
echo "View logs: pm2 logs amc-backend"
echo "Restart: pm2 restart amc-backend"
