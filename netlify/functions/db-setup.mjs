import { neon } from '@netlify/neon';

export default async (req) => {
    const sql = neon();

    try {
        // Create tables
        await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

        await sql`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price INTEGER NOT NULL,
        price_display VARCHAR(20) NOT NULL,
        image VARCHAR(500) NOT NULL,
        amenities TEXT[] NOT NULL
      )
    `;

        await sql`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        room VARCHAR(255) NOT NULL,
        checkin DATE NOT NULL,
        checkout DATE NOT NULL,
        price INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'Confirmed',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

        await sql`
      CREATE TABLE IF NOT EXISTS inquiries (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

        await sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        text TEXT NOT NULL,
        rating INTEGER DEFAULT 5,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

        // Seed rooms if empty
        const existingRooms = await sql`SELECT COUNT(*) as count FROM rooms`;
        if (parseInt(existingRooms[0].count) === 0) {
            await sql`
        INSERT INTO rooms (name, price, price_display, image, amenities) VALUES
        ('Deluxe King Room', 2500, '2,500', 'https://placehold.co/600x400/800020/D4AF37?text=Deluxe+King+Room', ARRAY['King Bed', 'City View', 'Free Wifi']),
        ('Executive Suite', 4500, '4,500', 'https://placehold.co/600x400/800020/D4AF37?text=Executive+Suite', ARRAY['Living Area', 'Ocean View', 'Mini Bar']),
        ('Presidential Suite', 8000, '8,000', 'https://placehold.co/600x400/800020/D4AF37?text=Presidential+Suite', ARRAY['Private Pool', 'Butler Service', 'Jacuzzi'])
      `;
        }

        // Seed default reviews if empty
        const existingReviews = await sql`SELECT COUNT(*) as count FROM reviews`;
        if (parseInt(existingReviews[0].count) === 0) {
            await sql`
        INSERT INTO reviews (name, text, rating) VALUES
        ('Vikram Rathore', 'A truly royal experience. The suite was magnificent.', 5),
        ('Ananya Desai', 'Beautiful architecture and warm hospitality. Felt like a palace.', 4),
        ('Rajesh Hamal', 'Best hotel in Kathmandu. Highly recommended for luxury stay!', 5)
      `;
        }

        return new Response(JSON.stringify({ success: true, message: 'Database initialized successfully!' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
