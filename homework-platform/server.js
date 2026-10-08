const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { getDb, update } = require('./db/store');

const app = express();
const PORT = 3000;

// Ensure upload folders exist
const UPLOADS = path.join(__dirname, 'uploads');
const ASSIGN_FILES = path.join(UPLOADS, 'assignments');
const SUB_FILES = path.join(UPLOADS, 'submissions');
[UPLOADS, ASSIGN_FILES, SUB_FILES].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer config – total ~20 MB
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isTeacher = req.path.includes('/teacher/');
    cb(null, isTeacher ? ASSIGN_FILES : SUB_FILES);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, unique + '-' + safe);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB per file
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|txt|zip|rar)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only images, PDF, Word and common documents are allowed'));
    }
  }
});

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS));

app.use(session({
  secret: 'homework-secret-key-change-later',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// Make moment available in all templates
app.locals.moment = moment;

// Auth helpers
function requireTeacher(req, res, next) {
  if (req.session && req.session.isTeacher) return next();
  res.redirect('/teacher/login');
}

// ========== PUBLIC / HOME ==========
app.get('/', (req, res) => {
  res.render('home');
});

// ========== TEACHER ROUTES ==========
app.get('/teacher/login', (req, res) => {
  if (req.session.isTeacher) return res.redirect('/teacher');
  res.render('teacher/login', { error: null });
});

app.post('/teacher/login', (req, res) => {
  const db = getDb();
  const password = (req.body.password || '').trim();
  if (password === db.settings.teacherPassword) {
    req.session.isTeacher = true;
    return res.redirect('/teacher');
  }
  res.render('teacher/login', { error: 'Wrong password' });
});

app.get('/teacher/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/teacher', requireTeacher, (req, res) => {
  const db = getDb();
  res.render('teacher/dashboard', {
    groups: db.groups,
    assignments: db.assignments
  });
});

// ---- Groups ----
app.get('/teacher/groups', requireTeacher, (req, res) => {
  const db = getDb();
  res.render('teacher/groups', { groups: db.groups });
});

app.post('/teacher/groups/add', requireTeacher, (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.redirect('/teacher/groups');
  update(db => {
    db.groups.push({
      id: uuidv4(),
      name,
      students: []
    });
  });
  res.redirect('/teacher/groups');
});

app.post('/teacher/groups/:id/delete', requireTeacher, (req, res) => {
  update(db => {
    db.groups = db.groups.filter(g => g.id !== req.params.id);
    // Also remove related assignments & submissions
    db.assignments = db.assignments.filter(a => a.groupId !== req.params.id);
    db.submissions = db.submissions.filter(s => s.groupId !== req.params.id);
  });
  res.redirect('/teacher/groups');
});

app.get('/teacher/groups/:id', requireTeacher, (req, res) => {
  const db = getDb();
  const group = db.groups.find(g => g.id === req.params.id);
  if (!group) return res.redirect('/teacher/groups');
  res.render('teacher/group-detail', { group });
});

app.post('/teacher/groups/:id/students', requireTeacher, (req, res) => {
  const namesRaw = req.body.students || '';
  const names = namesRaw
    .split('\n')
    .map(n => n.trim())
    .filter(n => n.length > 0);

  update(db => {
    const group = db.groups.find(g => g.id === req.params.id);
    if (group) {
      // Merge unique names
      const set = new Set([...group.students, ...names]);
      group.students = Array.from(set).sort();
    }
  });
  res.redirect('/teacher/groups/' + req.params.id);
});

app.post('/teacher/groups/:id/students/remove', requireTeacher, (req, res) => {
  const name = req.body.name;
  update(db => {
    const group = db.groups.find(g => g.id === req.params.id);
    if (group) {
      group.students = group.students.filter(s => s !== name);
    }
  });
  res.redirect('/teacher/groups/' + req.params.id);
});

// ---- Assignments ----
app.get('/teacher/assignments', requireTeacher, (req, res) => {
  const db = getDb();
  res.render('teacher/assignments', {
    assignments: db.assignments,
    groups: db.groups
  });
});

app.get('/teacher/assignments/new', requireTeacher, (req, res) => {
  const db = getDb();
  res.render('teacher/assignment-form', {
    groups: db.groups,
    assignment: null
  });
});

app.post('/teacher/assignments/new', requireTeacher, upload.array('files', 5), (req, res) => {
  const { groupId, title, description, deadline } = req.body;
  if (!groupId || !title || !deadline) {
    return res.redirect('/teacher/assignments/new');
  }

  const files = (req.files || []).map(f => ({
    originalName: f.originalname,
    storedName: f.filename,
    size: f.size
  }));

  update(db => {
    db.assignments.push({
      id: uuidv4(),
      groupId,
      title: title.trim(),
      description: (description || '').trim(),
      deadline,
      files,
      createdAt: new Date().toISOString()
    });
  });
  res.redirect('/teacher/assignments');
});

app.get('/teacher/assignments/:id', requireTeacher, (req, res) => {
  const db = getDb();
  const assignment = db.assignments.find(a => a.id === req.params.id);
  if (!assignment) return res.redirect('/teacher/assignments');

  const group = db.groups.find(g => g.id === assignment.groupId);
  const submissions = db.submissions.filter(s => s.assignmentId === assignment.id);

  // Build status list for every student
  const studentStatus = (group?.students || []).map(name => {
    const sub = submissions.find(s => s.studentName === name);
    return { name, submission: sub || null };
  });

  res.render('teacher/assignment-detail', {
    assignment,
    group,
    studentStatus,
    moment
  });
});

app.post('/teacher/assignments/:id/delete', requireTeacher, (req, res) => {
  update(db => {
    db.assignments = db.assignments.filter(a => a.id !== req.params.id);
    db.submissions = db.submissions.filter(s => s.assignmentId !== req.params.id);
  });
  res.redirect('/teacher/assignments');
});

app.post('/teacher/submissions/:id/check', requireTeacher, (req, res) => {
  update(db => {
    const sub = db.submissions.find(s => s.id === req.params.id);
    if (sub) {
      sub.checked = true;
      sub.checkedAt = new Date().toISOString();
    }
  });
  const db = getDb();
  const sub = db.submissions.find(s => s.id === req.params.id);
  res.redirect('/teacher/assignments/' + (sub ? sub.assignmentId : ''));
});

app.post('/teacher/submissions/:id/uncheck', requireTeacher, (req, res) => {
  update(db => {
    const sub = db.submissions.find(s => s.id === req.params.id);
    if (sub) {
      sub.checked = false;
      sub.checkedAt = null;
    }
  });
  const db = getDb();
  const sub = db.submissions.find(s => s.id === req.params.id);
  res.redirect('/teacher/assignments/' + (sub ? sub.assignmentId : ''));
});

// ---- Settings ----
app.get('/teacher/settings', requireTeacher, (req, res) => {
  res.render('teacher/settings', { message: null, error: null });
});

app.post('/teacher/settings/password', requireTeacher, (req, res) => {
  const { current, newpass, confirm } = req.body;
  const db = getDb();

  if (current !== db.settings.teacherPassword) {
    return res.render('teacher/settings', { message: null, error: 'Current password is wrong' });
  }
  if (!newpass || newpass.length < 4) {
    return res.render('teacher/settings', { message: null, error: 'New password too short' });
  }
  if (newpass !== confirm) {
    return res.render('teacher/settings', { message: null, error: 'Passwords do not match' });
  }

  update(db => {
    db.settings.teacherPassword = newpass;
  });
  res.render('teacher/settings', { message: 'Password changed successfully', error: null });
});

// ========== STUDENT ROUTES ==========
app.get('/student', (req, res) => {
  const db = getDb();
  res.render('student/select-group', { groups: db.groups });
});

app.get('/student/group/:groupId', (req, res) => {
  const db = getDb();
  const group = db.groups.find(g => g.id === req.params.groupId);
  if (!group) return res.redirect('/student');

  const assignments = db.assignments
    .filter(a => a.groupId === group.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.render('student/group', {
    group,
    assignments,
    moment
  });
});

app.get('/student/group/:groupId/assignment/:assignmentId', (req, res) => {
  const db = getDb();
  const group = db.groups.find(g => g.id === req.params.groupId);
  const assignment = db.assignments.find(a => a.id === req.params.assignmentId);

  if (!group || !assignment || assignment.groupId !== group.id) {
    return res.redirect('/student');
  }

  res.render('student/submit', {
    group,
    assignment,
    moment,
    error: null,
    success: null
  });
});

app.post('/student/group/:groupId/assignment/:assignmentId/submit',
  upload.array('files', 10),
  (req, res) => {
    const db = getDb();
    const group = db.groups.find(g => g.id === req.params.groupId);
    const assignment = db.assignments.find(a => a.id === req.params.assignmentId);
    const studentName = (req.body.studentName || '').trim();

    if (!group || !assignment || assignment.groupId !== group.id) {
      return res.redirect('/student');
    }

    if (!studentName || !group.students.includes(studentName)) {
      return res.render('student/submit', {
        group, assignment, moment,
        error: 'Please select your name from the list',
        success: null
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.render('student/submit', {
        group, assignment, moment,
        error: 'Please upload at least one file',
        success: null
      });
    }

    // Check total size
    const totalSize = req.files.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > 20 * 1024 * 1024) {
      // Clean up uploaded files
      req.files.forEach(f => {
        try { fs.unlinkSync(f.path); } catch (e) {}
      });
      return res.render('student/submit', {
        group, assignment, moment,
        error: 'Total size of all files must be under 20 MB',
        success: null
      });
    }

    const now = new Date();
    const deadline = new Date(assignment.deadline);
    const isLate = now > deadline;

    const files = req.files.map(f => ({
      originalName: f.originalname,
      storedName: f.filename,
      size: f.size
    }));

    // Remove previous submission by same student for this assignment
    update(db => {
      db.submissions = db.submissions.filter(
        s => !(s.assignmentId === assignment.id && s.studentName === studentName)
      );

      db.submissions.push({
        id: uuidv4(),
        assignmentId: assignment.id,
        groupId: group.id,
        studentName,
        files,
        submittedAt: now.toISOString(),
        isLate,
        checked: false,
        checkedAt: null
      });
    });

    res.render('student/submit', {
      group, assignment, moment,
      error: null,
      success: isLate
        ? 'Submitted (LATE). Your teacher can still see it.'
        : 'Submitted successfully on time!'
    });
  }
);

// Student status page
app.get('/student/group/:groupId/status', (req, res) => {
  const db = getDb();
  const group = db.groups.find(g => g.id === req.params.groupId);
  if (!group) return res.redirect('/student');

  const assignments = db.assignments.filter(a => a.groupId === group.id);
  const submissions = db.submissions.filter(s => s.groupId === group.id);

  res.render('student/status', {
    group,
    assignments,
    submissions,
    moment
  });
});

// Download helper (simple)
app.get('/download/assignment/:filename', (req, res) => {
  const file = path.join(ASSIGN_FILES, req.params.filename);
  if (fs.existsSync(file)) res.download(file);
  else res.status(404).send('File not found');
});

app.get('/download/submission/:filename', (req, res) => {
  const file = path.join(SUB_FILES, req.params.filename);
  if (fs.existsSync(file)) res.download(file);
  else res.status(404).send('File not found');
});

// Error handler for multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message.includes('Only images')) {
    return res.status(400).send('Upload error: ' + err.message);
  }
  next(err);
});

// Start server – listen on all interfaces so phones can connect
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('========================================');
  console.log('  Homework Platform is running!');
  console.log('========================================');
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log('  On your network: http://YOUR-IP:3000');
  console.log('  Teacher password: Ab9006885');
  console.log('========================================');
  console.log('');
});
