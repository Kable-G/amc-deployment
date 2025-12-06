#!/bin/bash
# deploy-to-aws.sh - Automated deployment script for Auto Media Center

set -e  # Exit on any error

echo "🚀 Auto Media Center - AWS Deployment Script"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running on Ubuntu
if [[ ! -f /etc/lsb-release ]] || ! grep -q "Ubuntu" /etc/lsb-release; then
    print_error "This script is designed for Ubuntu. Please run on Ubuntu 22.04 LTS."
    exit 1
fi

print_info "Starting deployment on Ubuntu..."

# Update system
print_info "Updating system packages..."
sudo apt update && sudo apt upgrade -y
print_status "System updated successfully"

# Install Node.js 18
print_info "Installing Node.js 18..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_status "Node.js installed successfully"
else
    print_status "Node.js already installed"
fi

# Verify Node.js version
NODE_VERSION=$(node --version)
print_info "Node.js version: $NODE_VERSION"

# Install PM2
print_info "Installing PM2 process manager..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    print_status "PM2 installed successfully"
else
    print_status "PM2 already installed"
fi

# Install Git
print_info "Installing Git..."
if ! command -v git &> /dev/null; then
    sudo apt install git -y
    print_status "Git installed successfully"
else
    print_status "Git already installed"
fi

# Install Nginx
print_info "Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt install nginx -y
    sudo systemctl enable nginx
    print_status "Nginx installed and enabled"
else
    print_status "Nginx already installed"
fi

# Create application directory
APP_DIR="/var/www/automediacenter"
print_info "Creating application directory: $APP_DIR"
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Clone repository (if not already present)
if [ ! -d "$APP_DIR/.git" ]; then
    print_info "Repository not found. Please clone your repository manually:"
    print_warning "Run: git clone https://github.com/YOUR-USERNAME/amc-backend.git $APP_DIR"
    print_warning "Then run this script again."
    exit 1
fi

cd $APP_DIR

# Install dependencies
print_info "Installing Node.js dependencies..."
npm install --production
print_status "Dependencies installed successfully"

# Create uploads directory with proper permissions
print_info "Setting up uploads directory..."
mkdir -p public/uploads/center_assets
mkdir -p public/uploads/radar_teasers
mkdir -p public/uploads/vault_assets
chmod -R 755 public/uploads
print_status "Uploads directory configured"

# Copy production environment file
if [ -f ".env.production" ]; then
    print_info "Using existing .env.production file"
else
    print_warning ".env.production not found. Please create it with your production settings."
    exit 1
fi

# Configure Nginx
print_info "Configuring Nginx..."
sudo tee /etc/nginx/sites-available/automediacenter > /dev/null <<EOF
server {
    listen 80;
    server_name automediacenter.com www.automediacenter.com;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Static file caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/automediacenter /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
print_info "Testing Nginx configuration..."
if sudo nginx -t; then
    print_status "Nginx configuration is valid"
    sudo systemctl restart nginx
    print_status "Nginx restarted successfully"
else
    print_error "Nginx configuration test failed"
    exit 1
fi

# Start application with PM2
print_info "Starting application with PM2..."
pm2 stop amc-backend 2>/dev/null || true
pm2 delete amc-backend 2>/dev/null || true

# Use production server file if it exists, otherwise use regular server.js
if [ -f "server.production.js" ]; then
    SERVER_FILE="server.production.js"
    print_info "Using production server configuration"
else
    SERVER_FILE="server.js"
    print_info "Using standard server configuration"
fi

pm2 start $SERVER_FILE --name "amc-backend" --env production
pm2 save
pm2 startup | tail -1 | sudo bash

print_status "Application started successfully with PM2"

# Install SSL certificate with Let's Encrypt
print_info "Installing SSL certificate..."
if ! command -v certbot &> /dev/null; then
    sudo apt install certbot python3-certbot-nginx -y
fi

print_warning "To complete SSL setup, run:"
print_warning "sudo certbot --nginx -d automediacenter.com -d www.automediacenter.com"

# Display status
print_info "Checking application status..."
pm2 status
pm2 logs amc-backend --lines 10

# Final instructions
echo ""
echo "🎉 Deployment Complete!"
echo "======================"
print_status "Your application is now running on this server"
print_info "Application URL: http://$(curl -s ifconfig.me):5000"
print_info "With domain: http://automediacenter.com (after DNS setup)"
print_info "PM2 Status: pm2 status"
print_info "View Logs: pm2 logs amc-backend"
print_info "Restart App: pm2 restart amc-backend"

echo ""
print_warning "Next Steps:"
echo "1. Configure DNS to point automediacenter.com to this server's IP"
echo "2. Run SSL certificate setup: sudo certbot --nginx -d automediacenter.com -d www.automediacenter.com"
echo "3. Test your application at https://automediacenter.com"

echo ""
print_info "Server IP Address: $(curl -s ifconfig.me)"
echo "🚀 Deployment script completed successfully!"