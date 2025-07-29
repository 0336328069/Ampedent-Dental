import dbConnect from '@/lib/dbConnect'
import { isSuperAdmin } from '@/lib/isSuperAdmin'
import sqlite3 from 'sqlite3'

export async function GET(req: Request) {
  try {
    const role = await isSuperAdmin()
    if (role === 'superadmin' || role === 'admin') {
      const db = await dbConnect()
      
      return new Promise<Response>((resolve, reject) => {
        db.all('SELECT id, name, role FROM users', (err, users) => {
          if (err) {
            reject(err)
          } else {
            resolve(Response.json({ message: 'User fetched', users: users || [] }))
          }
        })
      })
    } else {
      return Response.json({ message: 'Unauthorized' }, { status: 401 })
    }
  } catch (error: any) {
    console.error('GET users error:', error)
    return Response.json({ message: error.message }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const role = await isSuperAdmin()
    if (role === 'superadmin') {
      const body = await req.json()
      const { _id, name, password } = body
      const db = await dbConnect()

      return new Promise<Response>((resolve, reject) => {
        // Check if user exists
        db.get('SELECT * FROM users WHERE id = ?', [_id], (err, user) => {
          if (err) {
            reject(err)
          } else if (!user) {
            resolve(Response.json({ message: 'User not found' }, { status: 404 }))
          } else {
            // Update user
            let updateQuery = 'UPDATE users SET '
            let params: any[] = []
            
            if (name) {
              updateQuery += 'name = ?'
              params.push(name)
            }
            
            if (password && password !== '') {
              if (params.length > 0) updateQuery += ', '
              updateQuery += 'password = ?'
              params.push(password)
            }
            
            updateQuery += ' WHERE id = ?'
            params.push(_id)
            
            db.run(updateQuery, params, function(err) {
              if (err) {
                reject(err)
              } else {
                resolve(Response.json({ message: 'User updated' }))
              }
            })
          }
        })
      })
    } else {
      return Response.json({ message: 'Unauthorized' }, { status: 401 })
    }
  } catch (error: any) {
    console.error('PUT users error:', error)
    return Response.json({ message: error.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const _id = url.searchParams.get('_id') || url.searchParams.get('id')
    const role = await isSuperAdmin()

    if (role === 'superadmin') {
      const db = await dbConnect()
      
      return new Promise<Response>((resolve, reject) => {
        // Check if user exists and is not superadmin
        db.get('SELECT * FROM users WHERE id = ?', [_id], (err, user: any) => {
          if (err) {
            reject(err)
          } else if (!user) {
            resolve(Response.json({ message: 'User not found' }, { status: 404 }))
          } else if (user.role === 'superadmin') {
            resolve(Response.json({ message: 'Cannot delete superadmin' }, { status: 400 }))
          } else {
            // Delete user
            db.run('DELETE FROM users WHERE id = ?', [_id], function(err) {
              if (err) {
                reject(err)
              } else {
                resolve(Response.json({ message: 'User deleted' }))
              }
            })
          }
        })
      })
    } else {
      return Response.json({ message: 'Unauthorized' }, { status: 401 })
    }
  } catch (error) {
    console.error('DELETE users error:', error)
    return Response.json({ message: 'Could not delete user' }, { status: 500 })
  }
}
