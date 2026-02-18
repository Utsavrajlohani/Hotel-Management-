import { neon } from '@netlify/neon';

export default async (req) => {
    const sql = neon();
    const headers = { 'Content-Type': 'application/json' };

    try {
        if (req.method === 'POST') {
            const { name, email, message } = await req.json();

            const result = await sql`
        INSERT INTO inquiries (name, email, message)
        VALUES (${name}, ${email}, ${message})
        RETURNING *
      `;

            return new Response(JSON.stringify({ success: true, inquiry: result[0] }), { status: 201, headers });
        }

        if (req.method === 'GET') {
            const inquiries = await sql`SELECT * FROM inquiries ORDER BY created_at DESC`;
            return new Response(JSON.stringify({ success: true, inquiries }), { status: 200, headers });
        }

        if (req.method === 'DELETE') {
            const url = new URL(req.url);
            const id = url.searchParams.get('id');

            if (!id) {
                return new Response(JSON.stringify({ success: false, error: 'Missing inquiry ID' }), { status: 400, headers });
            }

            await sql`DELETE FROM inquiries WHERE id = ${id}`;
            return new Response(JSON.stringify({ success: true, message: 'Inquiry deleted' }), { status: 200, headers });
        }

        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers });
    }
};
