const db = require("./database");

// Check users table
const users = db.prepare("SELECT * FROM users").all();
console.log("Users:", users);

// Check complaints table
const complaints = db.prepare("SELECT * FROM complaints").all();
console.log("Complaints:", complaints);