const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://nexus:rootpassword@localhost:5432/nexus' });
pool.query("SELECT * FROM messages WHERE chat_id = '0d137b7a-0ada-4907-99ef-a070309fbb19'")
  .then(res => { console.log(res.rows); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
