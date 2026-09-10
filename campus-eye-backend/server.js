 // ============================================
// CampusEye Backend - SQLite (Simple Schema)
// ============================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require("./database");

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../'))); // Serve frontend

// Upload folder
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer setup (saves complaint photo)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only image files allowed'), false)
});

// ============================================
// HELPERS
// ============================================

function findUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email);
}

// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/register', (req, res) => {
  const { name, email, password, department, year } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
  }

  if (findUserByEmail(email)) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  const result = db.prepare("INSERT INTO users (name, email, password, department, year) VALUES (?, ?, ?, ?, ?)")
    .run(name, email, password, department || null, year || null);

  res.json({
    success: true,
    message: 'Registration successful',
    user: {
      id: result.lastInsertRowid,
      name,
      email,
      department: department || null,
      year: year || null
    }
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required' });
  }

  const user = findUserByEmail(email);
  if (!user) return res.status(401).json({ success: false, message: 'User not found' });
  if (user.password !== password) return res.status(401).json({ success: false, message: 'Wrong password' });

  res.json({
    success: true,
    message: 'Login successful',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
      year: user.year
    }
  });
});

// ============================================
// COMPLAINT ROUTES (IMAGE UPLOAD)
// ============================================

app.post('/api/complaints', upload.single('photo'), (req, res) => {
  const { user_id, category, description, status } = req.body;

  if (!user_id || !category || !description) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, message: 'user_id, category, and description are required' });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(user_id));
  if (!user) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const photoPath = req.file ? '/uploads/' + req.file.filename : null;

  const result = db.prepare(`
    INSERT INTO complaints (user_id, category, description, photo, status) 
    VALUES (?, ?, ?, ?, ?)
  `).run(Number(user_id), category, description, photoPath, status || 'pending');

  const complaint = db.prepare("SELECT * FROM complaints WHERE id = ?").get(result.lastInsertRowid);

  res.json({
    success: true,
    message: 'Complaint submitted successfully',
    complaint
  });
});

app.get('/api/complaints/user/:user_id', (req, res) => {
  const complaints = db.prepare("SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC")
    .all(Number(req.params.user_id));
  res.json({ success: true, complaints });
});

app.get('/api/complaints', (req, res) => {
  const { user_id, status, search } = req.query;
  let sql = "SELECT * FROM complaints WHERE 1=1";
  const params = [];

  if (user_id) {
    sql += " AND user_id = ?";
    params.push(Number(user_id));
  }
  if (status && status !== 'all') {
    sql += " AND status = ?";
    params.push(status);
  }
  if (search) {
    sql += " AND (category LIKE ? OR description LIKE ?)";
    params.push('%' + search + '%', '%' + search + '%');
  }

  sql += " ORDER BY created_at DESC";

  const complaints = db.prepare(sql).all(...params);
  res.json({ success: true, complaints });
});

app.put('/api/complaints/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  const validStatuses = ['pending', 'in progress', 'resolved'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const complaint = db.prepare("SELECT * FROM complaints WHERE id = ?").get(id);
  if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

  db.prepare("UPDATE complaints SET status = ? WHERE id = ?").run(status, id);

  res.json({
    success: true,
    message: 'Status updated',
    complaint: { ...complaint, status }
  });
});

// ============================================
// DASHBOARD STATS
// ============================================

app.get('/api/dashboard/user/:user_id', (req, res) => {
  const uid = Number(req.params.user_id);
  const total = db.prepare("SELECT COUNT(*) as c FROM complaints WHERE user_id = ?").get(uid).c;
  const pending = db.prepare("SELECT COUNT(*) as c FROM complaints WHERE user_id = ? AND status = ?").get(uid, 'pending').c;
  const inProgress = db.prepare("SELECT COUNT(*) as c FROM complaints WHERE user_id = ? AND status = ?").get(uid, 'in progress').c;
  const resolved = db.prepare("SELECT COUNT(*) as c FROM complaints WHERE user_id = ? AND status = ?").get(uid, 'resolved').c;

  res.json({ success: true, stats: { total, pending, inProgress, resolved } });
});

app.get('/api/dashboard/admin', (req, res) => {
  const total = db.prepare("SELECT COUNT(*) as c FROM complaints").get().c;
  const pending = db.prepare("SELECT COUNT(*) as c FROM complaints WHERE status = ?").get('pending').c;
  const inProgress = db.prepare("SELECT COUNT(*) as c FROM complaints WHERE status = ?").get('in progress').c;
  const resolved = db.prepare("SELECT COUNT(*) as c FROM complaints WHERE status = ?").get('resolved').c;

  res.json({ success: true, stats: { total, pending, inProgress, resolved } });
});

// Redirect root
app.get('/', (req, res) => res.redirect('/login_page.html'));

app.listen(PORT, () => {
  console.log('============================================');
  console.log('  CampusEye Backend Running!');
  console.log('  URL: http://localhost:' + PORT);
  console.log('  SQLite: users + complaints');
  console.log('  Images: /uploads/');
  console.log('============================================');
});