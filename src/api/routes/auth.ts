import { Router } from 'express';
import jwt from 'jsonwebtoken';

export default function authRoutes() {
    const router = Router();
    const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-dnd-key-2026';

    router.get('/login', (req, res) => {
        const clientId = process.env.DISCORD_CLIENT_ID;
        if (!clientId) {
            return res.status(500).send('Discord Client ID is missing in .env');
        }
        
        // Dynamically get the host so it works on phone (if registered in Discord portal)
        const host = req.get('host') || 'localhost:3001';
        const redirectUri = encodeURIComponent(`http://${host}/api/auth/callback`);
        
        const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
        res.redirect(discordAuthUrl);
    });

    router.get('/callback', async (req, res) => {
        const code = req.query.code as string;
        if (!code) return res.status(400).send('No code provided');

        const clientId = process.env.DISCORD_CLIENT_ID!;
        const clientSecret = process.env.DISCORD_CLIENT_SECRET!;
        const host = req.get('host') || 'localhost:3001';
        const redirectUri = `http://${host}/api/auth/callback`;

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
                return res.status(400).send('Discord OAuth Error: ' + tokenData.error_description);
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

            // Set cookie and redirect to frontend
            res.cookie('auth_token', token, {
                httpOnly: true,
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
            });

            // Redirect back to the frontend root
            res.redirect('/');
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
