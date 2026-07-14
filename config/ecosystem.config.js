module.exports = {
  apps: [
    {
      name: "amc-backend",
      script: "./server.js",
      cwd: "/home/ec2-user/amc-deployment",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      },
      // Restart policy - keep the app alive across crashes, but avoid
      // rapid crash-loop if something is fundamentally broken.
      max_restarts: 10,
      min_uptime: "30s",
      restart_delay: 4000,
      // Log files - adjust path if you prefer PM2's default log location
      out_file: "/home/ec2-user/.pm2/logs/amc-backend-out.log",
      error_file: "/home/ec2-user/.pm2/logs/amc-backend-error.log",
      time: true
    }
  ]
};
