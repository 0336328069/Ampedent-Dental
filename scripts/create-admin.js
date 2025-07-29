const sqlite3 = require('sqlite3').verbose()
const bcrypt = require('bcryptjs')
const path = require('path')

async function createAdmin() {
  const dbPath = path.join(__dirname, '..', 'ampedent.db')
  const db = new sqlite3.Database(dbPath)

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 10)
    
    // Insert admin user
    db.run(
      'INSERT OR REPLACE INTO users (name, password, role) VALUES (?, ?, ?)',
      ['admin', hashedPassword, 'admin'],
      function(err) {
        if (err) {
          console.error('Error creating admin:', err)
        } else {
          console.log('Admin user created successfully!')
          console.log('Username: admin')
          console.log('Password: admin123')
        }
        db.close()
      }
    )
  } catch (error) {
    console.error('Error:', error)
    db.close()
  }
}

createAdmin() 