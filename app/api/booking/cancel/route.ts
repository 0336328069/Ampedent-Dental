import dbConnect from '@/lib/dbConnect'
import { isSuperAdmin } from '@/lib/isSuperAdmin'
import sqlite3 from 'sqlite3'

export async function PUT(req: Request) {
  try {
    const db = await dbConnect()
    const url = new URL(req.url)
    const _id = url.searchParams.get('_id') || url.searchParams.get('id')

    const role = await isSuperAdmin()
    if (role === 'superadmin' || role === 'admin') {
      if (_id) {
        return new Promise<Response>((resolve, reject) => {
          db.run(
            'UPDATE bookings SET status = ? WHERE id = ?',
            ['canceled', _id],
            function(err) {
              if (err) {
                reject(err)
              } else {
                resolve(Response.json({ message: 'Booking updated' }))
              }
            }
          )
        })
      } else {
        return Response.json({ message: 'Booking ID required' }, { status: 400 })
      }
    } else {
      return Response.json({ message: 'Unauthorized' }, { status: 401 })
    }
  } catch (error) {
    console.error('PUT cancel error:', error)
    return Response.json({ message: 'Could not update bookings' }, { status: 500 })
  }
}
