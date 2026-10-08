import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-dnd-key-2026';

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
