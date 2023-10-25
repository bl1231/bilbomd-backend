export {}

declare global {
  // eslint-disable-next-line no-unused-vars
  namespace Express {
    export interface Request {
      user?: string
      roles?: string[]
      email?: string
    }
  }
}
