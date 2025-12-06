# AWS Deployment Guide - Auto Media Center

## Overview
This guide will deploy your Node.js application to AWS EC2 with the following architecture:
- **EC2 Instance** (t3.small) - Basic server (~$15/month)
- **MongoDB Atlas** - Keep existing database (already configured)
- **Local file storage** initially (upgrade to S3 later)
- **Basic domain setup** with Route 53 for automediacenter.com

**Estimated Monthly Cost: ~$20-25**

## Phase 1: AWS Account Setup

### Step 1: Create AWS Account
1. Go to https://aws.amazon.com/
2. Click "Create an AWS Account"
3. Follow the registration process
4. **Important**: Set up billing alerts immediately
   - Go to AWS Billing Dashboard
   - Set alert for $25/month

### Step 2: Create IAM User (Security Best Practice)
1. Go to IAM Console
2. Click "Users" → "Add User"
3. Username: `amc-deployer`
4. Access type: ✅ Programmatic access
5. Attach policies:
   - `AmazonEC2FullAccess`
   - `AmazonRoute53FullAccess`
   - `AmazonS3FullAccess` (for future use)
6. **Save the Access Key ID and Secret** - you'll need these!

### Step 3: Install AWS CLI
```bash
# Install AWS CLI
npm install -g aws-cli

# Configure with your credentials
aws configure
# Enter your Access Key ID
# Enter your Secret Access Key
# Default region: us-east-1
# Default output format: json
```

## Phase 2: Launch EC2 Instance

### Step 4: Create EC2 Instance
1. Go to EC2 Console
2. Click "Launch Instance"
3. **Configuration**:
   - Name: `amc-backend-server`
   - AMI: Ubuntu Server 22.04 LTS (Free tier eligible)
   - Instance type: `t3.small` (2 vCPU, 2GB RAM)
   - Key pair: Create new → `amc-keypair.pem` (Download and save!)
   - Security Group: Create new
     - SSH (22): Your IP only
     - HTTP (80): Anywhere (0.0.0.0/0)
     - HTTPS (443): Anywhere (0.0.0.0/0)
     - Custom TCP (5000): Anywhere (for testing)

### Step 5: Connect to Your Server
```bash
# Make key file secure (Mac/Linux)
chmod 400 amc-keypair.pem

# Connect to server (replace with your instance IP)
ssh -i amc-keypair.pem ubuntu@YOUR-EC2-PUBLIC-IP
```

## Phase 3: Server Setup

### Step 6: Install Dependencies on EC2
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 (Process Manager)
sudo npm install -g pm2

# Install Git
sudo apt install git -y

# Verify installations
node --version
npm --version
pm2 --version
```

### Step 7: Clone and Setup Your Application
```bash
# Clone your repository (you'll need to create a GitHub repo first)
git clone https://github.com/YOUR-USERNAME/amc-backend.git
cd amc-backend

# Install dependencies
npm install --production

# Create production environment file
nano .env.production
```

**Contents of .env.production:**
```env
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://gregkable:%40Kimber001@automediacenter.zwfbdct.mongodb.net/?retryWrites=true&w=majority
JWT_SECRET=amc-super-secret-jwt-key-for-authentication-2025-secure
```

### Step 8: Start Application with PM2
```bash
# Start the application
pm2 start server.js --name "amc-backend" --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command it gives you (copy/paste the sudo command)

# Check status
pm2 status
pm2 logs amc-backend
```

## Phase 4: Domain Setup (Optional but Recommended)

### Step 9: Purchase Domain (if needed)
1. Go to Route 53 Console
2. Click "Registered domains" → "Register domain"
3. Choose your domain (e.g., `automediacenter.com`)
4. Complete purchase (~$12/year)

### Step 10: Configure DNS
1. Go to Route 53 → "Hosted zones"
2. Click your domain
3. Create "A" record:
   - Name: (leave blank for root domain)
   - Type: A
   - Value: Your EC2 Public IP
4. Create "CNAME" record:
   - Name: www
   - Type: CNAME
   - Value: your-domain.com

## Phase 5: Testing

### Step 11: Test Your Deployment
1. **Direct IP Access**: `http://YOUR-EC2-IP:5000`
2. **Domain Access**: `http://your-domain.com:5000`
3. **API Test**: `http://your-domain.com:5000/api/v1/auth/login`

### Step 12: Frontend Access
Your frontend files should be accessible at:
- `http://your-domain.com:5000/automediacenter.html`
- `http://your-domain.com:5000/manage_releases.html`
- etc.

## Phase 6: Security & Production Hardening

### Step 13: Install Nginx (Reverse Proxy)
```bash
# Install Nginx
sudo apt install nginx -y

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/amc-backend
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/amc-backend /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test and restart Nginx
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### Step 14: SSL Certificate (Free with Let's Encrypt)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

## Phase 7: Monitoring & Maintenance

### Step 15: Basic Monitoring Setup
```bash
# Monitor PM2 processes
pm2 monit

# View logs
pm2 logs amc-backend

# Restart if needed
pm2 restart amc-backend

# Update application
git pull
npm install --production
pm2 restart amc-backend
```

## Troubleshooting

### Common Issues:
1. **Can't connect**: Check security groups allow port 80/443
2. **App won't start**: Check `pm2 logs` for errors
3. **Database connection**: Verify MongoDB Atlas IP whitelist includes EC2 IP
4. **File uploads**: Ensure `/public/uploads` directory exists and has write permissions

### Useful Commands:
```bash
# Check server status
sudo systemctl status nginx
pm2 status

# View logs
sudo tail -f /var/log/nginx/error.log
pm2 logs amc-backend

# Restart services
sudo systemctl restart nginx
pm2 restart amc-backend
```

## Next Steps After Basic Deployment

1. **Upgrade to S3**: Move file uploads to AWS S3
2. **Add CloudFront**: CDN for faster global access
3. **Database Backup**: Automated MongoDB Atlas backups
4. **Monitoring**: CloudWatch integration
5. **Auto-scaling**: Load balancer + multiple instances

## Cost Breakdown
- EC2 t3.small: ~$15/month
- Route 53 domain: ~$1/month
- Data transfer: ~$1-5/month
- **Total: ~$17-21/month**

---

**Ready to start? Begin with Phase 1: AWS Account Setup!**