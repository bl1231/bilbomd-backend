import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

const verifyGitHubSecret = (req: Request, res: Response, next: NextFunction) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  const signature = req.headers['x-hub-signature-256'] as string
  const payload = JSON.stringify(req.body)

  if (!signature || !secret) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  // Compute the HMAC hex digest
  const hmac = crypto.createHmac('sha256', secret)
  const digest = 'sha256=' + hmac.update(payload).digest('hex')

  // Compare the computed digest with the signature
  const signatureBuffer = Buffer.from(signature)
  const digestBuffer = Buffer.from(digest)

  // Convert Buffer to Uint8Array for comparison
  if (
    crypto.timingSafeEqual(
      new Uint8Array(
        signatureBuffer.buffer,
        signatureBuffer.byteOffset,
        signatureBuffer.length
      ),
      new Uint8Array(digestBuffer.buffer, digestBuffer.byteOffset, digestBuffer.length)
    )
  ) {
    next() // Signature matches, proceed to the next middleware
  } else {
    res.status(401).json({ message: 'Invalid signature' })
  }
}

export default verifyGitHubSecret
