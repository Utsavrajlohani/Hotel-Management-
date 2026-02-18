import { neon } from '@netlify/neon';

export default async (req) => {
    const sql = neon();
    const headers = { 'Content-Type': 'application/json' };

    try {
        if (req.method === 'POST') {
            const { name, email, dob, govt_id_name, govt_id_data, room, checkin, checkout, price, status } = await req.json();

            const result = await sql`
        INSERT INTO bookings (name, email, dob, govt_id_name, govt_id_data, room, checkin, checkout, price, status)
        VALUES (${name}, ${email}, ${dob || null}, ${govt_id_name || null}, ${govt_id_data || null}, ${room}, ${checkin}, ${checkout}, ${price}, ${status || 'Confirmed'})
        RETURNING *
      `;

            return new Response(JSON.stringify({ success: true, booking: result[0] }), { status: 201, headers });
        }

        if (req.method === 'GET') {
            const bookings = await sql`SELECT * FROM bookings ORDER BY created_at DESC`;
            return new Response(JSON.stringify({ success: true, bookings }), { status: 200, headers });
        }

        if (req.method === 'DELETE') {
            const url = new URL(req.url);
            const id = url.searchParams.get('id');

            if (!id) {
                return new Response(JSON.stringify({ success: false, error: 'Missing booking ID' }), { status: 400, headers });
            }

            await sql`DELETE FROM bookings WHERE id = ${id}`;
            return new Response(JSON.stringify({ success: true, message: 'Booking deleted' }), { status: 200, headers });
        }

        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers });
    }
};
