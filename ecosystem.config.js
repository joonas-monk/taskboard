// Source: PM2 official docs + Next.js SQLite constraint research
// /home/deploy/taskboard/ecosystem.config.js

require('dotenv').config({ path: '.env.production' })

module.exports = {
  apps: [{
    name: 'taskboard',
    script: '.next/standalone/server.js',
    cwd: '/home/deploy/taskboard',
    exec_mode: 'fork',      // NOT cluster — SQLite requires single writer
    instances: 1,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: '3000',
      HOSTNAME: '127.0.0.1',
      DATABASE_URL: process.env.DATABASE_URL,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      PIPELINE_MODEL: process.env.PIPELINE_MODEL || 'claude-3-5-haiku-20241022',
      HOME: process.env.HOME || '/home/deploy',
      PATH: process.env.PATH,
    },
    out_file: '/var/log/taskboard/out.log',
    error_file: '/var/log/taskboard/err.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
}
