import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-dnd-key-2026';

if (!process.env.JWT_SECRET) {
    console.warn('[SECURITY WARNING] JWT_SECRET is not set in environment variables! Using default fallback key. Please define JWT_SECRET in your .env file for production security.');
}

export interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        avatar: string | null;
    };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
    const token = req.cookies?.auth_token;
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
}
