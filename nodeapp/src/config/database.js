const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

// Create connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'whatsjet',
    waitForConnections: true,
    connectionLimit: 20,        // Max 20 concurrent connections
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Test connection
pool.getConnection()
    .then(connection => {
        console.log('✓ MySQL connection pool established');
        connection.release();
    })
    .catch(err => {
        console.error('✗ MySQL connection failed:', err.message);
        process.exit(1);
    });

module.exports = pool;
