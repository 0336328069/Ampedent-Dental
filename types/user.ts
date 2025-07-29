export type SQLiteUserType = {
  id: number
  name: string
  password: string
  role: 'admin' | 'superadmin'
} 