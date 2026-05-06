import { AdminUser } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: string
        username: string
        role: string
        iat?: number
        exp?: number
      }
    }
  }
}
