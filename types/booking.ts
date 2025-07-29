export type SQLiteBookingType = {
  id: number
  firstName: string
  lastName: string
  email: string
  phone: string
  message: string
  status: 'pending' | 'completed' | 'canceled'
  date: string
  time: string
  createdAt: string
} 