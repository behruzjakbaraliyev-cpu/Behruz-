const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default database structure
const defaultDb = {
  settings: {
    teacherPassword: 'Ab9006885'   // plain for simplicity, can hash later
  },
  groups: [],          // { id, name, students: ['Full Name 1', 'Full Name 2', ...] }
  assignments: [],     // { id, groupId, title, description, deadline, files: [], createdAt }
  submissions: []      // { id, assignmentId, groupId, studentName, files: [], submittedAt, isLate, checked, checkedAt }
};

function load() {
  if (!fs.existsSync(DB_FILE)) {
    save(defaultDb);
    return JSON.parse(JSON.stringify(defaultDb));
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('DB load error, using default', e.message);
    return JSON.parse(JSON.stringify(defaultDb));
  }
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getDb() {
  return load();
}

function update(updater) {
  const db = load();
  updater(db);
  save(db);
  return db;
}

module.exports = { getDb, update, save, load };
