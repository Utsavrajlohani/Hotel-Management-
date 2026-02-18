import { neon } from '@netlify/neon';

export default async (req) => {
    const sql = neon();
    const headers = { 'Content-Type': 'application/json' };

    try {
        if (req.method === 'POST') {
            const body = await req.json();
            const { action, name, phone, password } = body;

            if (action === 'register') {
                // Check if user already exists
                const existing = await sql`SELECT id FROM users WHERE phone = ${phone}`;
                if (existing.length > 0) {
                    return new Response(JSON.stringify({ success: false, error: 'Phone number already registered' }), { status: 400, headers });
                }

                const result = await sql`
          INSERT INTO users (name, phone, password)
          VALUES (${name}, ${phone}, ${password})
          RETURNING id, name, phone
        `;

                return new Response(JSON.stringify({ success: true, user: result[0] }), { status: 201, headers });
            }

            if (action === 'login') {
                const result = await sql`
          SELECT id, name, phone FROM users
          WHERE phone = ${phone} AND password = ${password}
        `;

                if (result.length === 0) {
                    return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), { status: 401, headers });
                }

                return new Response(JSON.stringify({ success: true, user: result[0] }), { status: 200, headers });
            }

            return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), { status: 400, headers });
        }

        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers });
    }
};
