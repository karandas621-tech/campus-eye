 // ============================================
// CampusEye Backend - With Image Upload
// ============================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../'))); // Serve frontend
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve images

// ============================================
// SETUP IMAGE UPLOAD FOLDER
// ============================================

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// Configure multer for image storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // Create unique filename: complaint-timestamp-originalname
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// Only allow image files
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

// ============================================
// LOAD / SAVE DATA
// ============================================

let users = [];
let complaints = [];
let nextUserId = 1;
let nextComplaintId = 1;

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(raw);
      users = data.users || [];
      complaints = data.complaints || [];
      nextUserId = data.nextUserId || 1;
      nextComplaintId = data.nextComplaintId || 1;
      console.log('Data loaded from data.json');
    } catch (err) {
      console.log('Error loading data, starting fresh.');
    }
  }

  const hasAdmin = users.find(u => u.role === 'Admin');
  if (!hasAdmin) {
    users.push({
      id: 0,
      fullName: 'Admin User',
      email: 'admin@college.edu',
      rollNumber: 'ADMIN001',
      department: 'Administration',
      year: 'N/A',
      password: 'admin123',
      role: 'Admin'
    });
    saveData();
  }
}

function saveData() {
  const data = { users, complaints, nextUserId, nextComplaintId };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

loadData();

// ============================================
// HELPER FUNCTIONS
// ============================================

function findUserByEmail(email) {
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

function findUserById(id) {
  return users.find(u => u.id === id);
}

function getComplaintsByStudent(studentId) {
  return complaints.filter(c => c.studentId === studentId);
}

function getComplaintCounts(studentId = null) {
  const list = studentId ? getComplaintsByStudent(studentId) : complaints;
  return {
    total: list.length,
    pending: list.filter(c => c.status === 'pending').length,
    inProgress: list.filter(c => c.status === 'in progress').length,
    resolved: list.filter(c => c.status === 'resolved').length
  };
}

// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/register', (req, res) => {
  const { fullName, email, rollNumber, department, year, password } = req.body;

  if (!fullName || !email || !rollNumber || !department || !year || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  if (findUserByEmail(email)) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  const newUser = {
    id: nextUserId++,
    fullName, email, rollNumber, department, year,
    password,
    role: 'Student'
  };

  users.push(newUser);
  saveData();

  res.json({
    success: true,
    message: 'Registration successful',
    user: {
      id: newUser.id,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role
    }
  });
});

app.post('/api/login', (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required' });
  }

  const user = findUserByEmail(email);
  if (!user) return res.status(401).json({ success: false, message: 'User not found' });
  if (user.password !== password) return res.status(401).json({ success: false, message: 'Wrong password' });
  if (role && user.role !== role) return res.status(401).json({ success: false, message: 'Role mismatch' });

  res.json({
    success: true,
    message: 'Login successful',
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      department: user.department,
      year: user.year,
      rollNumber: user.rollNumber
    }
  });
});

// ============================================
// COMPLAINT ROUTES (WITH IMAGE UPLOAD)
// ============================================

// Submit complaint with optional image
app.post('/api/complaints', upload.single('image'), (req, res) => {
  const { title, category, location, description, priority, studentId } = req.body;

  if (!title || !category || !location || !description || !priority || !studentId) {
    // Delete uploaded file if validation fails
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  const student = findUserById(Number(studentId));
  if (!student) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  const newComplaint = {
    id: nextComplaintId++,
    title,
    category,
    location,
    description,
    priority,
    status: 'pending',
    studentId: Number(studentId),
    studentName: student.fullName,
    date: new Date().toISOString().split('T')[0],
    image: req.file ? '/uploads/' + req.file.filename : null
  };

  complaints.push(newComplaint);
  saveData();

  res.json({
    success: true,
    message: 'Complaint submitted successfully',
    complaint: newComplaint
  });
});

app.get('/api/complaints/student/:studentId', (req, res) => {
  const studentId = Number(req.params.studentId);
  res.json({ success: true, complaints: getComplaintsByStudent(studentId) });
});

app.get('/api/complaints', (req, res) => {
  const { status, search } = req.query;
  let result = [...complaints];

  if (status && status !== 'all') {
    result = result.filter(c => c.status === status);
  }

  if (search) {
    const term = search.toLowerCase();
    result = result.filter(c =>
      c.studentName.toLowerCase().includes(term) ||
      c.title.toLowerCase().includes(term)
    );
  }

  res.json({ success: true, complaints: result });
});

app.put('/api/complaints/:id/status', (req, res) => {
  const complaintId = Number(req.params.id);
  const { status } = req.body;

  const validStatuses = ['pending', 'in progress', 'resolved'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const complaint = complaints.find(c => c.id === complaintId);
  if (!complaint) {
    return res.status(404).json({ success: false, message: 'Complaint not found' });
  }

  complaint.status = status;
  saveData();

  res.json({ success: true, message: 'Status updated', complaint });
});

// ============================================
// DASHBOARD STATS
// ============================================

app.get('/api/dashboard/student/:studentId', (req, res) => {
  res.json({ success: true, stats: getComplaintCounts(Number(req.params.studentId)) });
});

app.get('/api/dashboard/admin', (req, res) => {
  res.json({ success: true, stats: getComplaintCounts() });
});

// Redirect root to login
app.get('/', (req, res) => {
  res.redirect('/login_page.html');
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log('============================================');
  console.log('  CampusEye Backend is running!');
  console.log('  URL: http://localhost:' + PORT);
  console.log('============================================');
  console.log('');
  console.log('Demo Admin Login:');
  console.log('  Email: admin@college.edu');
  console.log('  Password: admin123');
  console.log('  Role: Admin');
  console.log('');
  console.log('Images saved to: /uploads/');
  console.log('============================================');
});