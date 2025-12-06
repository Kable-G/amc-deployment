# 🔧 Fix Connection Issue - Create Proper .pem File

## Step 1: Close the Frozen PowerShell Window
- **Close the PowerShell window** that's stuck asking for "yes/no"
- **Open a NEW PowerShell window** as Administrator

## Step 2: Create Your .pem Key File

In the new PowerShell window, run these commands:

```powershell
# Navigate to your user directory
cd C:\Users\Administrator\

# Create .ssh directory if it doesn't exist
mkdir .ssh -ErrorAction SilentlyContinue

# Navigate to .ssh directory
cd .ssh
```

Now create your key file:
```powershell
# Create the .pem file with your private key
@"
-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEAxFOCTj7zT/h0MXR8EUbYGOa+c19nnVWRAZIWMk0Xr0PyKqw4
POyNn31ybfl4M+jNqzKRCLpe8VXQiHo26mSLklr8VxeXWH4wO+chuJM4DsaVIbaV
Liz9p5/9c/A9c7lqko0mklDxUZfkqoeXRqbRhDMz+uUN46mau9jy3F85bLe+pu63
59WpKQt5pUoMbqILiJCniCSYAUeXiFveBHeCsXn7EevD73vK+6gCENJr4SGLE7Zg
CKUQEQkc6ANxhabBJQECyb9oBMp0r6XRLm8VvwvMXosQpl0rjPsHmDS57L1DqwD7
FC7ZA3016uGxhLzUpNbRVPrG7zT2BI7IqfNiMwIDAQABAoIBAQCCk9x2OG5SQTje
78/ZGdp+7XG8gLcEsTWp6sUynY3kN3fpI/SfqOIlMyWZubRWKkAo3pASUwr0zxPM
wiSmT0t5g2SUdI9n/z4LiZYnElvVkAT+kFa2iJwJEmNb6myk/KzCXnlKFeX7U+B1
/4sBJdDyca/f7tsHEfZlfE1Df15NTNqaaXt59wJ2fQFZkCddwpOLVNbrltxpA2H6
DRSIKWf95Tz7+suxefopGh+aOaSMCjhzJQTQxglSZ+g7cDzViT28p8C5ErFEhBCQ
UqRu3/rbJXyP9WQ6OHfDZKVXhWObCmAdYGHd976nZRkpo8nm75cGumNdg7VkioFP
R+0gB1fhAoGBAOG4KN9/73ucEfp1z5h7Phw4U+DsBJYyW1rqM0GqiRCfp71+JeDP
X61Yu4xYSryxNlcee/wYm4IWYQrVhkOuswP7gYjdN6m0OERpzROCeI7rkI1pn5rc
UZiBLwNguXNyjNZVk56BS5V4L6wH96GkO7fZjqFpPhwv96CSb5F/7fwxAoGBAN6p
57E8ZQh6JJOXSAiFhhKxc5xl1f64RY3W5FJL9DZGP6BrU5+MciVt8nm/Z+maMVwE
CwNGRCS8zOEKw18+uPE6Kywi9ApRCHccdseupoIP9EF6wUFeZmgt+EJ4UMz8K+Ll
VNcZ2j69OycY9VRGqbsME6n+Gf77i2kuMuZH5/+jAoGBAMIhLl4S3Th1oWzE2Fev
X1rMAzAGLWe0Rafql0zZy+qVNaIfFZrFH+ep0hvBb/3bd/3zhPTrgQugDbRQspoR
bXt2WxEIGbCGBIKqcCtgYimhZgCJoDCDXlYIfROto7IsCf7pOP3w+73A0Vdmvs6x
vn6/yRD/v+BkTNg4OWZtHZRxAoGAThChk6kJ/xPbuQckESDHJcyjLOUjRr/SWu1J
dXT9tP2iFxsp4Vk7N9Y5Wef6hZMy1QDx338GKx8qcYf1gXIbIy/yrPHAP9GzNxd6
qX2ZESaIy2A/Wyy+mK3tSVinc4bB2DXxLcz5kF+F2qpMcPSpU1PjnQjiklwcv46b
99KkCyMCgYEAjzwT34S4kvyDTb+Rarp5vmUk9EqJn2KJ/bb/OMOHGMKRy1nae1FR
kE+AjmwElkOmlldcRF0WAucJnc1vAJ/di0ediaBNOAryLAysyFHSfaF/S9JT+2gj
SgIh+DnX1iEXlQxtYkE1FNkkR7YiCF2UhaWa1LESOjXHX0cE7L+qjrs=
-----END RSA PRIVATE KEY-----
"@ | Out-File -FilePath "amc-key.pem" -Encoding ASCII
```

## Step 3: Set Proper Permissions

```powershell
# Set proper permissions on the key file
icacls "amc-key.pem" /inheritance:r
icacls "amc-key.pem" /grant:r "$env:USERNAME:(R)"
```

## Step 4: Test Connection

```powershell
# Test SSH connection
ssh -i amc-key.pem ubuntu@51.20.76.73
```

When it asks "Are you sure you want to continue connecting (yes/no)?", type `yes` and press Enter.

## Alternative: Use AWS CloudShell Instead

If the SSH connection still doesn't work, let's use AWS CloudShell directly:

1. **Go back to your AWS Console**
2. **Look for the CloudShell icon** (terminal icon) in the top toolbar
3. **Click it** to open AWS CloudShell
4. **Run this command** to connect to your instance:

```bash
# In AWS CloudShell
aws ec2-instance-connect ssh --instance-id i-04b1174db65329d4a --os-user ubuntu
```

## Step 5: Once Connected, Deploy Your App

Once you're connected (either via SSH or CloudShell), run these commands:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Create app directory
mkdir amc-backend && cd amc-backend

# Create a simple test server
cat > server.js << 'EOF'
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('<h1>Auto Media Center</h1><p>Server is running on AWS!</p>');
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
EOF

# Install express
npm init -y
npm install express

# Start with PM2
pm2 start server.js --name "amc-backend"
pm2 save
pm2 startup

# Install and configure Nginx
sudo apt install nginx -y
sudo tee /etc/nginx/sites-available/default > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

sudo systemctl restart nginx
```

## Step 6: Test Your Deployment

Visit **http://51.20.76.73** in your browser - you should see "Auto Media Center - Server is running on AWS!"

---

**Try the SSH connection first, but if it doesn't work, use AWS CloudShell as the alternative!**