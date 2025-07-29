import dbConnect from '@/lib/dbConnect'
import CredentialsProvider from 'next-auth/providers/credentials'
import { NextAuthOptions, DefaultSession } from 'next-auth'
import bcrypt from 'bcryptjs'

// Extend NextAuth types
declare module "next-auth" {
  interface User {
    role?: string
  }
  interface Session {
    user: {
      role?: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string
  }
}

const authOptions: NextAuthOptions = {
  secret: process.env.SECRET,
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      id: 'credentials',
      credentials: {
        name: { label: 'Name', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        const name = credentials?.name
        const password = credentials?.password

        if (!name || !password) {
          return null
        }

        const db = await dbConnect()
        
        return new Promise((resolve, reject) => {
          db.get('SELECT * FROM users WHERE name = ?', [name], async (err, user: any) => {
            if (err) {
              console.error('Auth error:', err)
              resolve(null)
            } else if (!user) {
              resolve(null)
            } else {
              // Compare password
              try {
                const isMatch = await bcrypt.compare(password, user.password)
                if (isMatch) {
                  resolve({
                    id: user.id.toString(),
                    name: user.name,
                    role: user.role,
                    email: user.name // NextAuth requires email field
                  })
                } else {
                  resolve(null)
                }
              } catch (bcryptError) {
                console.error('Password comparison error:', bcryptError)
                resolve(null)
              }
            }
          })
        })
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.role = token.role
      }
      return session
    },
  },
}

export default authOptions
