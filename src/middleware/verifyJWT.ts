import jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'

const verifyJWT = (req: Request, res: Response, next: NextFunction) => {
  // Check both 'authorization' and 'Authorization' headers and cast to string
  const authHeader = (req.headers.authorization || req.headers.Authorization) as string

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const token = authHeader.split(' ')[1]

  jwt.verify(
    token,
    process.env.ACCESS_TOKEN_SECRET || '',
    { algorithms: ['HS256'] },
    (error, decoded) => {
      if (error) {
        return res.status(403).json({ message: 'Forbidden - ', error })
      }

      const userInfo = decoded as { username: string; roles: string[] }

      if (userInfo) {
        req.user = userInfo.username
        req.roles = userInfo.roles
        next()
      } else {
        return res.status(403).json({ message: 'Forbidden - no userInfo' })
      }
    }
  )
}

export default verifyJWT
