// src/utils/authTokens.ts

import jwt from 'jsonwebtoken'
import { Response } from 'express'
import { IUser } from '@bl1231/bilbomd-mongodb-schema'

const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET ?? ''
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET ?? ''

export function issueTokensAndSetCookie(user: IUser, res: Response): string {
  const accessToken = jwt.sign(
    {
      UserInfo: {
        username: user.username,
        roles: user.roles,
        email: user.email
      }
    },
    accessTokenSecret,
    { expiresIn: '2m' }
  )

  const refreshToken = jwt.sign(
    {
      username: user.username,
      roles: user.roles,
      email: user.email
    },
    refreshTokenSecret,
    { expiresIn: '7d' }
  )

  const isProduction = process.env.NODE_ENV === 'production'
  res.cookie('jwt', refreshToken, {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000
  })

  return accessToken
}
