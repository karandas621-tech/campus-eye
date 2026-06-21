const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campuseye')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ========== MODELS ==========
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const complaintSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  category: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'In Progress', 'Resolved'], default: 'Pending' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, required: true },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const Complaint = mongoose.model('Complaint', complaintSchema);

// ========== AUTH ROUTES ==========
// Student Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role: 'student' });
    await user.save();
    res.status(201).json({ message: 'Student registered', userId: user._id, name: user.name, role: user.role });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Student Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, role: 'student' });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    res.json({ userId: user._id, name: user.name, email: user.email, role: user.role });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Admin Login
app.post('/api/auth/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, role: 'admin' });
    if (!user) return res.status(400).json({ message: 'Invalid admin credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid admin credentials' });
    res.json({ userId: user._id, name: user.name, email: user.email, role: user.role });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Seed Admin
app.post('/api/auth/seed-admin', async (req, res) => {
  try {
    const existingAdmin = await User.findOne({ email: 'admin@campuseye.com' });
    if (existingAdmin) return res.json({ message: 'Admin already exists' });
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = new User({ name: 'Admin', email: 'admin@campuseye.com', password: hashedPassword, role: 'admin' });
    await admin.save();
    res.json({ message: 'Admin created', email: 'admin@campuseye.com', password: 'admin123' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ========== COMPLAINT ROUTES ==========
// Submit Complaint
app.post('/api/complaints', async (req, res) => {
  try {
    const complaint = new Complaint(req.body);
    await complaint.save();
    res.status(201).json(complaint);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get All Complaints
app.get('/api/complaints/all', async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get My Complaints
app.get('/api/complaints/my/:studentId', async (req, res) => {
  try {
    const complaints = await Complaint.find({ studentId: req.params.studentId }).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Update Status
app.put('/api/complaints/:id', async (req, res) => {
  try {
    const complaint = await Complaint.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true });
    res.json(complaint);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete Complaint
app.delete('/api/complaints/:id', async (req, res) => {
  try {
    await Complaint.findByIdAndDelete(req.params.id);
    res.json({ message: 'Complaint deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ========== SERVE HTML PAGES ==========
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/report', (req, res) => res.sendFile(path.join(__dirname, 'report.html')));
app.get('/my-complaints', (req, res) => res.sendFile(path.join(__dirname, 'my-complaints.html')));
app.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'admin-login.html')));
app.get('/admin-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'admin-dashboard.html')));

app.listen(PORT, () => {
  console.log(`🚀 CampusEye running at http://localhost:${PORT}`);
});