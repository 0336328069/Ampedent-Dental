import dbConnect from '@/lib/dbConnect'
import { isSuperAdmin } from '@/lib/isSuperAdmin'
import sqlite3 from 'sqlite3'

export async function GET(req: Request) {
  try {
    const db = await dbConnect()
    const role = await isSuperAdmin()
    if (role === 'superadmin' || role === 'admin') {
      const url = new URL(req.url)
      const _id = url.searchParams.get('_id') || url.searchParams.get('id')

      if (_id) {
        return new Promise<Response>((resolve, reject) => {
          db.get('SELECT * FROM bookings WHERE id = ?', [_id], (err, booking) => {
            if (err) {
              reject(err)
            } else if (!booking) {
              resolve(Response.json({ message: 'Không tìm thấy lịch hẹn' }, { status: 404 }))
            } else {
              resolve(Response.json({ message: 'Booking fetched', booking: booking }))
            }
          })
        })
      }

      const status = url.searchParams.get('status')
      const search = url.searchParams.get('search')
      const page = Number(url.searchParams.get('page')) || 1
      const pageSize = 9

      let whereClause = '1=1'
      let params: any[] = []

      if (status && status !== 'all') {
        whereClause += ' AND status = ?'
        params.push(status)
      }

      if (search) {
        whereClause += ' AND (firstName LIKE ? OR lastName LIKE ? OR phone LIKE ? OR email LIKE ?)'
        const searchPattern = `%${search}%`
        params.push(searchPattern, searchPattern, searchPattern, searchPattern)
      }

      // Get total count
      const totalCount = await new Promise<number>((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM bookings WHERE ${whereClause}`, params, (err, result: any) => {
          if (err) reject(err)
          else resolve(result?.count || 0)
        })
      })

      const totalPages = Math.ceil(totalCount / pageSize)
      const offset = pageSize * (page - 1)

      // Get bookings with pagination
      const bookings = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `SELECT id, firstName, lastName, email, phone, message, date, time, status, createdAt FROM bookings WHERE ${whereClause} ORDER BY status DESC, date ASC, time ASC LIMIT ? OFFSET ?`,
          [...params, pageSize, offset],
          (err, rows) => {
            if (err) reject(err)
            else resolve(rows || [])
          }
        )
      })

      return Response.json({
        message: 'Bookings fetched',
        bookings,
        totalPages: totalPages,
      })
    } else {
      return Response.json({ message: 'Unauthorized' }, { status: 401 })
    }
  } catch (error) {
    console.error('GET error:', error)
    return Response.json({ message: 'Could not fetch bookings' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { firstName, lastName, email, phone, message, date, time } = body
    
    // Add validation back
    if (!firstName || firstName.trim() === '') {
      return Response.json({ message: 'First name is required' }, { status: 400 })
    }
    if (!/^[a-zA-ZÀ-ỹ\s]+$/.test(firstName.trim())) {
      return Response.json({ message: 'First name can only contain letters and spaces' }, { status: 400 })
    }
    
    if (!lastName || lastName.trim() === '') {
      return Response.json({ message: 'Last name is required' }, { status: 400 })
    }
    if (!/^[a-zA-ZÀ-ỹ\s]+$/.test(lastName.trim())) {
      return Response.json({ message: 'Last name can only contain letters and spaces' }, { status: 400 })
    }
    
    if (!email || email.trim() === '') {
      return Response.json({ message: 'Email is required' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return Response.json({ message: 'Invalid email format' }, { status: 400 })
    }
    
    if (!phone || phone.trim() === '') {
      return Response.json({ message: 'Phone number is required' }, { status: 400 })
    }
    if (!/^[0-9+\-\(\)\s]+$/.test(phone.trim())) {
      return Response.json({ message: 'Phone number can only contain numbers and special characters' }, { status: 400 })
    }
    
    if (!date) {
      return Response.json({ message: 'Date is required' }, { status: 400 })
    }
    const selectedDate = new Date(date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (selectedDate < today) {
      return Response.json({ message: 'Date must be in the present or future' }, { status: 400 })
    }
    
    if (!time || time.trim() === '') {
      return Response.json({ message: 'Please select a time slot' }, { status: 400 })
    }
    // Accept both HH:MM and HH:MM:SS.mmmZ formats
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]{3})?Z?)?$/
    if (!timeRegex.test(time)) {
      return Response.json({ message: 'Invalid time format' }, { status: 400 })
    }
    
    // Convert to HH:MM format for database storage
    const timeOnly = time.split(':').slice(0, 2).join(':')
    
    const db = await dbConnect()
    
    return new Promise<Response>((resolve, reject) => {
      db.run(
        'INSERT INTO bookings (firstName, lastName, email, phone, message, date, time) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [firstName, lastName, email, phone, message, date, timeOnly],
        function(err) {
          if (err) {
            console.error('Booking creation error:', err)
            resolve(Response.json({ message: err.message }, { status: 500 }))
          } else {
            resolve(Response.json({ 
              message: 'Booking created', 
              booking: { id: this.lastID, firstName, lastName, email, phone, message, date, time: timeOnly, status: 'pending' }
            }))
          }
        }
      )
    })
  } catch (error: any) {
    console.error('POST error:', error)
    return Response.json({ message: error.message }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const db = await dbConnect()
    const url = new URL(req.url)
    const _id = url.searchParams.get('_id') || url.searchParams.get('id')
    const role = await isSuperAdmin()
    
    if (role === 'superadmin' || role === 'admin') {
      if (!_id) {
        return Response.json({ message: 'Mã lịch hẹn không hợp lệ' }, { status: 400 })
      }
      
      const body = await req.json()
      const { action, newDate, newTime } = body
      
      // Check if booking exists
      const booking = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM bookings WHERE id = ?', [_id], (err, row) => {
          if (err) reject(err)
          else resolve(row)
        })
      })

      if (!booking) {
        return Response.json({ message: 'Booking not found' }, { status: 404 })
      }
      
      let updateQuery = ''
      let params: any[] = []
      
      if (action === 'confirm') {
        updateQuery = 'UPDATE bookings SET status = ? WHERE id = ?'
        params = ['confirmed', _id]
      } else if (action === 'cancel') {
        updateQuery = 'UPDATE bookings SET status = ? WHERE id = ?'
        params = ['canceled', _id]
      } else if (action === 'reschedule') {
        updateQuery = 'UPDATE bookings SET date = ?, time = ?, status = ? WHERE id = ?'
        params = [newDate, newTime, 'pending', _id]
      }
      
      if (updateQuery) {
        return new Promise<Response>((resolve, reject) => {
          db.run(updateQuery, params, function(err) {
            if (err) {
              resolve(Response.json({ message: 'Could not update booking' }, { status: 500 }))
            } else {
              resolve(Response.json({ message: 'Booking updated' }))
            }
          })
        })
      }
      
      return Response.json({ message: 'Invalid action' }, { status: 400 })
    } else {
      return Response.json({ message: 'Unauthorized' }, { status: 401 })
    }
  } catch (error) {
    console.error('PUT error:', error)
    return Response.json({ message: 'Could not update bookings' }, { status: 500 })
  }
}
