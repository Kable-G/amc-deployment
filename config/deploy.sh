#!/bin/bash
# AutoMediaCenter deploy script
# Usage: ./deploy.sh
set -e

echo "Pulling latest code..."
git pull

echo "Installing dependencies..."
npm ci

echo "Reloading PM2 process (zero-downtime)..."
pm2 reload amc-backend --update-env

echo "Deploy complete. Recent logs:"
pm2 logs amc-backend --lines 20 --nostream
