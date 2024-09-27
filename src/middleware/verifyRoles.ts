import { Request, Response, NextFunction } from 'express'

const verifyRoles = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.roles) return res.sendStatus(401) // Unauthorized
    const rolesArray = [...allowedRoles]
    // Need to read up on these Higher Order Functions.
    const result = req.roles
      .map((role) => rolesArray.includes(role))
      .find((val) => val === true)
    if (!result) return res.sendStatus(401) // Unauthorized
    console.log(rolesArray)
    next()
  }
}

export { verifyRoles }
