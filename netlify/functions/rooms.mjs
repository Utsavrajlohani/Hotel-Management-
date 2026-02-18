import { neon } from '@netlify/neon';

export default async (req) => {
    const sql = neon();
    const headers = { 'Content-Type': 'application/json' };

    try {
        if (req.method === 'GET') {
            const rooms = await sql`SELECT * FROM rooms ORDER BY id ASC`;
            return new Response(JSON.stringify({ success: true, rooms }), { status: 200, headers });
        }

        if (req.method === 'POST') {
            const { name, price, price_display, image, amenities } = await req.json();
            const result = await sql`
                INSERT INTO rooms (name, price, price_display, image, gallery, amenities)
                VALUES (${name}, ${price}, ${price_display || price.toString()}, ${image || null}, ARRAY[${image || ''}], ${amenities || []})
                RETURNING *
            `;
            return new Response(JSON.stringify({ success: true, room: result[0] }), { status: 201, headers });
        }

        if (req.method === 'PUT') {
            const { id, name, price, price_display, image, amenities } = await req.json();
            if (!id) return new Response(JSON.stringify({ success: false, error: 'Missing id' }), { status: 400, headers });
            await sql`
                UPDATE rooms SET name = ${name}, price = ${price}, price_display = ${price_display || price.toString()},
                image = ${image || null}, amenities = ${amenities || []}
                WHERE id = ${id}
            `;
            return new Response(JSON.stringify({ success: true, message: 'Room updated' }), { status: 200, headers });
        }

        if (req.method === 'DELETE') {
            const url = new URL(req.url);
            const id = url.searchParams.get('id');
            if (!id) return new Response(JSON.stringify({ success: false, error: 'Missing id' }), { status: 400, headers });
            await sql`DELETE FROM rooms WHERE id = ${id}`;
            return new Response(JSON.stringify({ success: true, message: 'Room deleted' }), { status: 200, headers });
        }

        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers });
    }
};
