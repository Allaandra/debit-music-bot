import { Router } from 'express';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { JWT_SECRET } from '../middlewares/authMiddleware';

export default function authRoutes() {
    const router = Router();
    // JWT_SECRET is imported from authMiddleware

    function ensureUserDirectories(userId: string) {
        try {
            const userSoundsDir = path.join(__dirname, '../../..', 'sounds', userId);
            const userSfxDir = path.join(userSoundsDir, 'sfx');
            if (!fs.existsSync(userSoundsDir)) fs.mkdirSync(userSoundsDir, { recursive: true });
            if (!fs.existsSync(userSfxDir)) fs.mkdirSync(userSfxDir, { recursive: true });
        } catch (err) {
            console.error('Error creating user directories:', err);
        }
    }

    function getRedirectUri(req: any): string {
        if (process.env.DISCORD_REDIRECT_URI) {
            return process.env.DISCORD_REDIRECT_URI;
        }
        let host = req.get('host') || 'localhost:3001';
        if (host.startsWith('127.0.0.1')) {
            host = host.replace(/^127\.0\.0\.1/, 'localhost');
        }
        return `http://${host}/api/auth/callback`;
    }

    function getSafeReturnTo(stateStr?: unknown): string {
        if (!stateStr || typeof stateStr !== 'string') return '/';
        try {
            const decoded = Buffer.from(stateStr, 'base64url').toString('utf-8');
            let candidate = decoded;
            try {
                const parsed = JSON.parse(decoded);
                if (parsed && typeof parsed.returnTo === 'string') {
                    candidate = parsed.returnTo;
                }
            } catch {
                // Not JSON, use decoded string directly
            }

            if (candidate.startsWith('/') && !candidate.startsWith('//')) {
                return candidate;
            }
            const parsedUrl = new URL(candidate);
            if (
                (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') &&
                (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1')
            ) {
                return candidate;
            }
        } catch {
            // Parsing failure fallback
        }
        return '/';
    }

    router.get('/login', (req, res) => {
        const clientId = process.env.DISCORD_CLIENT_ID;
        if (!clientId) {
            return res.status(500).send('Discord Client ID is missing in .env');
        }
        
        const redirectUri = encodeURIComponent(getRedirectUri(req));
        const returnTo = (req.headers.referer as string) || (req.query.returnTo as string) || '/';
        const state = Buffer.from(returnTo, 'utf-8').toString('base64url');
        
        const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify&state=${state}`;
        res.redirect(discordAuthUrl);
    });

    router.get('/callback', async (req, res) => {
        const code = req.query.code as string;
        if (!code) return res.status(400).send('No code provided');

        const clientId = process.env.DISCORD_CLIENT_ID!;
        const clientSecret = process.env.DISCORD_CLIENT_SECRET!;
        const redirectUri = getRedirectUri(req);

        try {
            // Exchange code for token
            const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: redirectUri
                })
            });

            const tokenData = await tokenResponse.json();
            if (tokenData.error) {
                console.error('OAuth Error:', tokenData);
                return res.redirect(`/?auth_error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
            }

            // Get user info
            const userResponse = await fetch('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });
            const userData = await userResponse.json();

            // Create our own JWT session
            const sessionData = {
                id: userData.id,
                username: userData.username,
                avatar: userData.avatar 
                    ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` 
                    : null
            };

            const token = jwt.sign(sessionData, JWT_SECRET, { expiresIn: '30d' });

            // Automatically create user sounds & sfx folders upon authentication
            ensureUserDirectories(userData.id);

            // Set cookie and redirect to frontend
            res.cookie('auth_token', token, {
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
            });

            // Redirect back to returnTo or frontend root
            const returnTo = getSafeReturnTo(req.query.state);
            res.redirect(returnTo);
        } catch (error) {
            console.error('Auth callback error:', error);
            res.status(500).send('Internal Server Error during authentication');
        }
    });

    router.get('/me', (req, res) => {
        const token = req.cookies?.auth_token;
        if (!token) return res.status(401).json({ error: 'Not authenticated' });

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if ((decoded as any)?.id) {
                ensureUserDirectories((decoded as any).id);
            }
            res.json(decoded);
        } catch (e) {
            res.status(401).json({ error: 'Invalid token' });
        }
    });

    router.post('/logout', (req, res) => {
        res.clearCookie('auth_token');
        res.json({ success: true });
    });

    return router;
}
