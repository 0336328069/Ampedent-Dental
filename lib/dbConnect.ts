import sqlite3 from 'sqlite3'
import path from 'path'

let db: sqlite3.Database | null = null

export async function dbConnect() {
  if (db) {
    return db
  }

  try {
    // Create database file in project root
    const dbPath = path.join(process.cwd(), 'ampedent.db')
    
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err)
        throw err
      }
      console.log('Connected to SQLite database')
    })

    // Create bookings table if it doesn't exist
    await new Promise<void>((resolve, reject) => {
      db!.run(`
        CREATE TABLE IF NOT EXISTS bookings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          firstName TEXT NOT NULL,
          lastName TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT NOT NULL,
          message TEXT,
          date TEXT NOT NULL,
          time TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating bookings table:', err)
          reject(err)
        } else {
          console.log('Bookings table ready')
          resolve()
        }
      })
    })

    // Create users table if it doesn't exist
    await new Promise<void>((resolve, reject) => {
      db!.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'admin',
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating users table:', err)
          reject(err)
        } else {
          console.log('Users table ready')
          resolve()
        }
      })
    })

    return db
  } catch (error) {
    console.error('Database connection error:', error)
    throw error
  }
}

export default dbConnect
