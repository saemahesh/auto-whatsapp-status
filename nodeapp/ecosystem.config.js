module.exports = {
    apps: [
        {
            name: 'whatsjet-nodejs',
            script: './src/index.js',
            instances: 1,  // Single process to handle Express + workers
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production',
                PORT: 3006
            },
            error_file: './logs/pm2-error.log',
            out_file: './logs/pm2-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G'
        }
    ]
};
