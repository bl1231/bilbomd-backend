export {}

declare global {
  namespace Express {
    export interface Request {
      user?: string
      roles?: string[]
      email?: string
      sfApiToken?: string
      id?: string
    }
  }
}
