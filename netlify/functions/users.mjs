import { neon } from '@netlify/neon';

export default async (req) => {
    const sql = neon();
    const headers = { 'Content-Type': 'application/json' };

    try {
        if (req.method === 'POST') {
            const { action, name, phone, password } = await req.json();

            // --- User Count (for admin dashboard) ---
            if (action === 'count') {
                const result = await sql`SELECT COUNT(*) as count FROM users`;
                return new Response(JSON.stringify({ success: true, count: parseInt(result[0].count) }), { status: 200, headers });
            }

            // --- Register ---
            if (action === 'register') {
                const existing = await sql`SELECT id FROM users WHERE phone = ${phone}`;
                if (existing.length > 0) {
                    return new Response(JSON.stringify({ success: false, error: 'Phone already registered' }), { status: 400, headers });
                }

                const result = await sql`
          INSERT INTO users (name, phone, password) VALUES (${name}, ${phone}, ${password})
          RETURNING id, name, phone
        `;
                return new Response(JSON.stringify({ success: true, user: result[0] }), { status: 201, headers });
            }

            // --- Login ---
            if (action === 'login') {
                const users = await sql`SELECT * FROM users WHERE phone = ${phone}`;
                if (users.length === 0) {
                    return new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404, headers });
                }

                const user = users[0];
                const storedPassword = user.password;

                // Check if password is hashed (contains ':')
                if (storedPassword.includes(':')) {
                    // Hashed password: salt:hash
                    const [salt, storedHash] = storedPassword.split(':');
                    // Hash the input password with the same salt
                    const encoder = new TextEncoder();
                    const data = encoder.encode(salt + password);
                    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                    if (inputHash === storedHash) {
                        return new Response(JSON.stringify({
                            success: true,
                            user: { id: user.id, name: user.name, phone: user.phone }
                        }), { status: 200, headers });
                    } else {
                        return new Response(JSON.stringify({ success: false, error: 'Invalid password' }), { status: 401, headers });
                    }
                } else {
                    // Plain text password (legacy users)
                    if (storedPassword === password) {
                        return new Response(JSON.stringify({
                            success: true,
                            user: { id: user.id, name: user.name, phone: user.phone }
                        }), { status: 200, headers });
                    } else {
                        return new Response(JSON.stringify({ success: false, error: 'Invalid password' }), { status: 401, headers });
                    }
                }
            }

            return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers });
        }

        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers });
    }
};
