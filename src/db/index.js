const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/meridian.db');

fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });

const db = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

module.exports = db;
