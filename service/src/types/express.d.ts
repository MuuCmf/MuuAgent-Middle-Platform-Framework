import { AdminUser } from '@prisma/client'

declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string
        originalname: string
        encoding: string
        mimetype: string
        size: number
        destination: string
        filename: string
        path: string
        buffer: Buffer
        stream?: NodeJS.ReadableStream
      }
    }

    interface Request {
      admin?: {
        id: string
        username?: string
        role: string
        scope?: string
        iat?: number
        exp?: number
      }
      file?: Express.Multer.File
      files?: Express.Multer.File[]
    }
  }
}
