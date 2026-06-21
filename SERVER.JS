// ============================================
// SERVER.JS (Place in campus-eye/ folder)
// ============================================
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect('mongodb://127.0.0.1:27017/campus-eye')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB Error:', err));

const ComplaintSchema = new mongoose.Schema({
    title: String,
    description: String,
    location: String,
    category: String,
    lat: { type: Number, default: 28.6139 },
    lng: { type: Number, default: 77.2090 },
    studentName: String,
    status: { type: String, default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});

const Complaint = mongoose.model('Complaint', ComplaintSchema);

app.get('/api/complaints', async (req, res) => {
    const complaints = await Complaint.find().sort({ createdAt: -1 });
    res.json(complaints);
});

app.post('/api/complaints', async (req, res) => {
    const complaint = new Complaint(req.body);
    await complaint.save();
    res.status(201).json({ id: complaint._id });
});

app.put('/api/complaints/:id', async (req, res) => {
    await Complaint.findByIdAndUpdate(req.params.id, { status: req.body.status });
    res.json({ message: 'Updated' });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));