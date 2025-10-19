module.exports = {
  apps: [{
    name: 'archetype',
    script: 'npm',
    args: 'run dev',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    // Restart policy
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    min_uptime: '10s',
    // Auto-restart on crashes
    listen_timeout: 10000,
    kill_timeout: 5000,
    // Health monitoring
    instance_var: 'INSTANCE_ID'
  }]
};
