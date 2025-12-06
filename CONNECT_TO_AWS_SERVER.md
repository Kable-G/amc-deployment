# 🔌 How to Connect to Your AWS Server from Windows

## What You Need
- Your AWS EC2 instance (already configured ✅)
- The `.pem` key file you downloaded when creating the instance
- Your server's Public IP address

## Step 1: Get Your Server Information

1. **Go to AWS EC2 Console**: https://console.aws.amazon.com/ec2/
2. **Click "Instances"** in the left sidebar
3. **Find your instance** and click on it
4. **Copy the "Public IPv4 address"** - you'll need this!

Example: `3.85.123.456` (your IP will be different)

## Step 2: Prepare Your Key File

1. **Find your `.pem` file** (downloaded when you created the instance)
2. **Move it to a safe location** like `C:\Users\Administrator\.ssh\`
3. **Create the .ssh folder if it doesn't exist**

## Step 3: Connect Using Different Methods

### Method A: Using Windows PowerShell (Recommended)

1. **Open PowerShell as Administrator**
2. **Navigate to your key file location**:
```powershell
cd C:\Users\Administrator\.ssh\
```

3. **Set proper permissions on the key file**:
```powershell
# Remove inheritance and set permissions
icacls "your-key-name.pem" /inheritance:r
icacls "your-key-name.pem" /grant:r "%username%:R"
```

4. **Connect to your server**:
```powershell
ssh -i your-key-name.pem ubuntu@YOUR-SERVER-IP
```

**Example**:
```powershell
ssh -i amc-keypair.pem ubuntu@3.85.123.456
```

### Method B: Using PuTTY (Alternative)

1. **Download PuTTY**: https://www.putty.org/
2. **Convert .pem to .ppk format**:
   - Open PuTTYgen
   - Click "Load" and select your `.pem` file
   - Click "Save private key" and save as `.ppk`

3. **Connect with PuTTY**:
   - Host Name: `ubuntu@YOUR-SERVER-IP`
   - Port: 22
   - Connection Type: SSH
   - Go to SSH → Auth → Browse and select your `.ppk` file
   - Click "Open"

### Method C: Using Git Bash (If you have Git installed)

1. **Open Git Bash**
2. **Navigate to your key file**:
```bash
cd /c/Users/Administrator/.ssh/
```

3. **Set permissions**:
```bash
chmod 400 your-key-name.pem
```

4. **Connect**:
```bash
ssh -i your-key-name.pem ubuntu@YOUR-SERVER-IP
```

## Step 4: First Connection

When you connect for the first time, you'll see:
```
The authenticity of host 'YOUR-IP' can't be established.
ECDSA key fingerprint is SHA256:...
Are you sure you want to continue connecting (yes/no)?
```

**Type `yes` and press Enter**

You should then see:
```
Welcome to Ubuntu 22.04.3 LTS (GNU/Linux 5.15.0-1040-aws x86_64)
ubuntu@ip-172-31-xx-xx:~$
```

🎉 **You're now connected to your AWS server!**

## Step 5: Verify Connection

Test that everything works:
```bash
# Check system info
uname -a

# Check available space
df -h

# Check if you can install packages
sudo apt update
```

## Troubleshooting

### "Permission denied (publickey)" Error
- **Check key file permissions**: Make sure only you can read the `.pem` file
- **Verify username**: Use `ubuntu` for Ubuntu instances
- **Check IP address**: Make sure you're using the Public IP, not Private IP

### "Connection timed out" Error
- **Check Security Groups**: Ensure port 22 (SSH) is open to your IP
- **Verify instance is running**: Check AWS console that instance state is "running"
- **Check your internet**: Try from a different network

### "Host key verification failed" Error
- **Remove old host key**: 
```powershell
ssh-keygen -R YOUR-SERVER-IP
```

### Can't Find .pem File
- **Check Downloads folder**: `C:\Users\Administrator\Downloads\`
- **Re-download from AWS**: Go to EC2 → Key Pairs → Actions → Download

## Next Steps After Connecting

Once you're connected to your server, you can:

1. **Upload your application code**
2. **Install Node.js and dependencies**
3. **Configure your application**
4. **Start your server**

## Quick Commands Reference

```bash
# Connect to server
ssh -i your-key.pem ubuntu@YOUR-IP

# Copy files to server (from your local machine)
scp -i your-key.pem -r C:\path\to\your\files ubuntu@YOUR-IP:/home/ubuntu/

# Disconnect from server
exit
```

## Security Tips

- **Never share your .pem file**
- **Keep it in a secure location**
- **Set proper file permissions**
- **Consider using SSH agent for convenience**

---

**Need help?** Make sure you have:
1. ✅ Your server's Public IP address
2. ✅ Your .pem key file
3. ✅ PowerShell or SSH client installed

**Ready to deploy your application once connected!**