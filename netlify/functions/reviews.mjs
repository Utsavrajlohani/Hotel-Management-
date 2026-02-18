import { neon } from '@netlify/neon';

export default async (req) => {
    const sql = neon();
    const headers = { 'Content-Type': 'application/json' };

    try {
        if (req.method === 'POST') {
            const { name, text, rating } = await req.json();

            const result = await sql`
        INSERT INTO reviews (name, text, rating)
        VALUES (${name}, ${text}, ${rating || 5})
        RETURNING *
      `;

            return new Response(JSON.stringify({ success: true, review: result[0] }), { status: 201, headers });
        }

        if (req.method === 'GET') {
            const reviews = await sql`SELECT * FROM reviews ORDER BY created_at DESC`;
            return new Response(JSON.stringify({ success: true, reviews }), { status: 200, headers });
        }

        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers });
    }
};
