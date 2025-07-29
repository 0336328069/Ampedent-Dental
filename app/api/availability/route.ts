import { allTimes } from '@/data/times'
import dbConnect from '@/lib/dbConnect'
import { unstable_noStore as noStore } from 'next/cache'

export async function GET(req: Request) {
  noStore()
  try {
    const url = new URL(req.url)
    const date = url.searchParams.get('date')



    if (!date) {
      throw new Error('Date parameter is required')
    }

    // Parse date properly - handle both ISO string and other formats
    let selectedDate: Date
    try {
      // If it's a full date string, extract just the date part
      if (date.includes('GMT') || date.includes('T')) {
        // Extract YYYY-MM-DD from full date string
        const dateMatch = date.match(/(\d{4})-(\d{2})-(\d{2})/)
        if (dateMatch) {
          selectedDate = new Date(dateMatch[0])
        } else {
          // Try to parse as is
          selectedDate = new Date(date)
        }
      } else {
        selectedDate = new Date(date)
      }
      
      // Validate date
      if (isNaN(selectedDate.getTime())) {
        throw new Error('Invalid date format')
      }
    } catch (parseError) {
      console.error('Date parsing error:', parseError)
      throw new Error('Invalid date format')
    }

    const dayOfWeek = selectedDate.getDay()
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      throw new Error('No available times on Saturday or Sunday')
    }

    const db = await dbConnect()

    // Create date range without modifying the original date
    const startOfDay = new Date(selectedDate)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(selectedDate)
    endOfDay.setHours(23, 59, 59, 999)

    // Convert dates to ISO string for SQLite comparison
    const startDateStr = startOfDay.toISOString()
    const endDateStr = endOfDay.toISOString()

    // Get bookings for the selected date
    const bookings = await new Promise<any[]>((resolve, reject) => {
      db.all(
        'SELECT * FROM bookings WHERE date >= ? AND date <= ?',
        [startDateStr, endDateStr],
        (err, rows) => {
          if (err) reject(err)
          else resolve(rows || [])
        }
      )
    })

    const bookedAndNotCanceledTimes = bookings
      .filter(booking => booking.status !== 'canceled')
      .map(booking => booking.time)

    // Simplified logic - just filter out booked times
    const availableTimes = allTimes.filter(time => {
      return !bookedAndNotCanceledTimes.includes(time)
    })



    return Response.json({
      message: 'Available times fetched',
      availableTimes: availableTimes,
    })
  } catch (error) {
    return Response.json({ 
      message: 'Could not fetch available times', 
      error: error instanceof Error ? error.message : 'Unknown error',
      availableTimes: [] 
    }, { status: 500 })
  }
}
