const Database = require("better-sqlite3");

const db = new Database("campuseye.db");

console.log("SQLite database connected!");

module.exports = db;