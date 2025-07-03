import { Request, Response } from 'express'

export const handleOrcidConfirmation = (req: Request, res: Response) => {
  const data = req.session.orcidProfile

  if (!data) {
    res.status(400).json({ message: 'Missing ORCID session data' })
    return
  }

  res.status(200).json(data)
}
