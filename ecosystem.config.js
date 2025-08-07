module.exports = {
  apps: [
    {
      name: 'whatsapp-api',
      script: 'app.js',
      instances: 'max',
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=4096',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Auto-restart configuration
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'sessions'],
      
      // Advanced settings
      max_restarts: 10,
      min_uptime: '10s',
      autorestart: true,
      
      // Performance monitoring
      pmx: true,
      monitoring: true,
      
      // Cluster settings
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // Environment variables for production
      env_vars: {
        'NODE_OPTIONS': '--max-old-space-size=4096'
      }
    }
  ],

  deploy: {
    production: {
      user: 'ubuntu',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'https://github.com/your-repo/whatsapp-api.git',
      path: '/var/www/whatsapp-api',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
