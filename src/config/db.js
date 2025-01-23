const { Pool } = require('pg'); //pg is a module for interactions between Node.js and PostgreSQL
//Pool is a class that manages a pool of client connections to the database
const isProduction = process.env.NODE_ENV === 'production';


const pool = new Pool({
  //connectionString is a string that contains the connection information for the database
  //ssl is a boolean that determines whether to use SSL encryption
  connectionString: isProduction ? process.env.DATABASE_URL : null,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  ...(!isProduction && {
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
  })
});

// Add better error handling
pool.on('error', (err) => { //.on() is method to attach an event listner to pool object
  //event name is error:
  //callback function = (err) => {
  console.error('Unexpected error on idle client', err);
});

// Export the testConnection function instead of running it automatically
module.exports = pool; 