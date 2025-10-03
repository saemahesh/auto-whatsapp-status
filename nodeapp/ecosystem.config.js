module.exports = {
    apps: [
        {
            name: 'whatsjet-nodejs',
            script: './src/index.js',
            instances: 2,  // Run 2 instances for load balancing
            exec_mode: 'cluster',
            env: {
                NODE_ENV: 'production',
                PORT: 3006  // Changed from 3000 to 3006 per production requirements
            },
            error_file: './logs/pm2-error.log',
            out_file: './logs/pm2-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            autorestart: true,
            watch: false,
            max_memory_restart: '500M'
        },
        {
            name: 'whatsjet-webhook-worker',
            script: './src/workers/webhook-worker.js',
            instances: 1,
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production'
            },
            error_file: './logs/webhook-worker-error.log',
            out_file: './logs/webhook-worker-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            autorestart: true,
            watch: false,
            max_memory_restart: '500M'
        },
        {
            name: 'whatsjet-campaign-worker',
            script: './src/workers/campaign-worker.js',
            instances: 1,
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production'
            },
            error_file: './logs/campaign-worker-error.log',
            out_file: './logs/campaign-worker-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            autorestart: true,
            watch: false,
            max_memory_restart: '500M'
        }
    ]
};
