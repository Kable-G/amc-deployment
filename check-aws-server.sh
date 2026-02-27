#!/bin/bash

# Script to check what's on your AWS server
# Run this AFTER you have saved your PEM key and connected via SSH

echo "========================================="
echo "Checking AWS Server Contents"
echo "========================================="

echo ""
echo "[1] Current directory and files:"
ls -la

echo ""
echo "[2] Node.js version:"
node --version

echo ""
echo "[3] PM2 status:"
pm2 status 2>/dev/null || echo "PM2 not running"

echo ""
echo "[4] Running Node processes:"
ps aux | grep node

echo ""
echo "[5] Check if Backend directory exists:"
ls -la Backend/ 2>/dev/null || echo "No Backend directory"

echo ""
echo "[6] Check package.json:"
cat package.json 2>/dev/null | head -20 || echo "No package.json found"

echo ""
echo "[7] Environment variables:"
env | grep -E "NODE_ENV|MONGODB|JWT|PORT" || echo "No app env vars set"

echo ""
echo "[8] Check port 3000 usage:"
netstat -tlnp 2>/dev/null | grep 3000 || ss -tlnp | grep 3000 || echo "Port 3000 not in use"

echo ""
echo "========================================="
echo "Server check complete!"
echo "========================================="
