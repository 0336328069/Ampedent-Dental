import dbConnect from '@/lib/dbConnect'
import { isSuperAdmin } from '@/lib/isSuperAdmin'
import sqlite3 from 'sqlite3'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, password } = body
    const db = await dbConnect()
    const role = await isSuperAdmin()
    
    if (role === 'superadmin') {
      return new Promise<Response>((resolve, reject) => {
        db.run(
          'INSERT INTO users (name, password) VALUES (?, ?)',
          [name, password],
          function(err) {
            if (err) {
              console.error('User creation error:', err)
              resolve(Response.json({ message: err.message }, { status: 500 }))
            } else {
              resolve(Response.json({
                message: 'New user created',
                name: name,
                role: 'admin',
              }))
            }
          }
        )
      })
    } else {
      return Response.json({ message: 'Unauthorized' }, { status: 401 })
    }
  } catch (error: any) {
    console.error('POST register error:', error)
    return Response.json({ message: error.message }, { status: 500 })
  }
}
