import { Request, Response } from 'express';

export const getConfigsStuff = (req: Request, res: Response) => {
  // Retrieve the expiration date from the environment variable
  const tokenExpires = process.env.VITE_SFAPI_TOKEN_EXPIRES;

  // If the environment variable is not set, return an error
  if (!tokenExpires) {
    return res.status(500).json({ message: 'SFAPI token expiration date not set in environment variables' });
  }

  // Return the expiration date as a JSON object
  return res.json({ tokenExpires });
};
