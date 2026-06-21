const API_BASE = 'http://localhost:3000/api';

const CAMPUS_LOCATIONS = {
  'Hostel A': { lat: 28.6139, lng: 77.2090 },
  'Hostel B': { lat: 28.6145, lng: 77.2095 },
  'Hostel C': { lat: 28.6150, lng: 77.2100 },
  'Library': { lat: 28.6130, lng: 77.2085 },
  'Canteen': { lat: 28.6140, lng: 77.2080 },
  'Academic Block': { lat: 28.6125, lng: 77.2095 },
  'Sports Complex': { lat: 28.6155, lng: 77.2075 },
  'Parking': { lat: 28.6120, lng: 77.2070 },
  'Main Gate': { lat: 28.6115, lng: 77.2065 },
  'Auditorium': { lat: 28.6135, lng: 77.2105 },
  'Lab Block': { lat: 28.6128, lng: 77.2088 },
  'Medical Center': { lat: 28.6142, lng: 77.2078 },
  'Gym': { lat: 28.6152, lng: 77.2082 },
  'Garden Area': { lat: 28.6132, lng: 77.2072 },
  'ATM Area': { lat: 28.6148, lng: 77.2098 }
};

function getUser() {
  const user = localStorage.getItem('campuseye_user');
  return user ? JSON.parse(user) : null;
}

function setUser(user) {
  localStorage.setItem('campuseye_user', JSON.stringify(user));
}

function logout() {
  localStorage.removeItem('campuseye_user');
  window.location.href = '/login';
}

function requireAuth() {
  const user = getUser();
  if (!user) { window.location.href = '/login'; return null; }
  return user;
}

function requireAdmin() {
  const user = getUser();
  if (!user || user.role !== 'admin') { window.location.href = '/login'; return null; }
  return user;
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function updateNavbar() {
  const user = getUser();
  const userInfo = document.getElementById('userInfo');
  const navLinks = document.getElementById('navLinks');
  if (userInfo) {
    userInfo.innerHTML = `<div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div><span>${user.name}</span>${user.role === 'admin' ? '<span class="admin-badge">ADMIN</span>' : ''}`;
  }
  if (navLinks && user.role === 'admin') {
    navLinks.innerHTML = `<a href="/admin-dashboard" id="nav-dashboard">Dashboard</a><button class="logout-btn" onclick="logout()">Logout</button>`;
  }
}

function highlightNav() {
  const path = window.location.pathname;
  const navId = path.includes('admin') ? 'nav-dashboard' : path.includes('report') ? 'nav-report' : path.includes('my-complaints') ? 'nav-my' : path.includes('dashboard') ? 'nav-dashboard' : null;
  if (navId) { const el = document.getElementById(navId); if (el) el.classList.add('active'); }
}

document.addEventListener('DOMContentLoaded', () => { updateNavbar(); highlightNav(); });