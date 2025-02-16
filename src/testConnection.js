import db from './connectSQL.js';

db.query('SELECT 1', (err, result) => {
  if (err) {
    console.error('Query error:', err);
  } else {
    console.log('Connection Successful:', result);
  }
});