import authOptions from '@/lib/authOptions'
import dbConnect from '@/lib/dbConnect'
import { getServerSession } from 'next-auth'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (session) {
      const db = await dbConnect()
      
      return new Promise<Response>((resolve, reject) => {
        db.get('SELECT name, role FROM users WHERE name = ?', [session?.user?.name], (err, user: any) => {
          if (err) {
            reject(err)
          } else if (!user) {
            resolve(Response.json({ message: 'User not found' }, { status: 404 }))
          } else {
            resolve(Response.json({
              message: 'user fetched',
              user: user.name,
              role: user.role,
            }))
          }
        })
      })
    } else {
      return Response.json({ message: 'Unauthorized' }, { status: 401 })
    }
  } catch (error) {
    console.error('GET me error:', error)
    return Response.json({ message: 'Could not fetch user' }, { status: 500 })
  }
}
