import { neon } from '@netlify/neon';

export default async (req) => {
  const sql = neon();
  const headers = { 'Content-Type': 'application/json' };

  try {
    // Users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Rooms table (with gallery)
    await sql`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price INTEGER NOT NULL,
        price_display VARCHAR(50),
        image TEXT,
        gallery TEXT[],
        amenities TEXT[]
      )
    `;

    // Bookings table (with DOB and Govt ID)
    await sql`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        dob DATE,
        govt_id_name VARCHAR(255),
        govt_id_data TEXT,
        room VARCHAR(255) NOT NULL,
        checkin DATE NOT NULL,
        checkout DATE NOT NULL,
        price INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'Confirmed',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Inquiries table
    await sql`
      CREATE TABLE IF NOT EXISTS inquiries (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Reviews table (with rating)
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
        INSERT INTO rooms (name, price, price_display, image, gallery, amenities) VALUES
        ('Deluxe King Room', 2500, '2,500', 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=600&h=400&fit=crop&q=80',
         ARRAY['https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=600&h=400&fit=crop&q=80','https://images.unsplash.com/photo-1590490360182-c33d955bc97c?w=600&h=400&fit=crop&q=80','https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=600&h=400&fit=crop&q=80'],
         ARRAY['King Bed', 'City View', 'Free Wifi']),
        ('Executive Suite', 4500, '4,500', 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&h=400&fit=crop&q=80',
         ARRAY['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&h=400&fit=crop&q=80','https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=600&h=400&fit=crop&q=80','https://images.unsplash.com/photo-1591088398332-8a7791972843?w=600&h=400&fit=crop&q=80'],
         ARRAY['Living Area', 'Ocean View', 'Mini Bar']),
        ('Presidential Suite', 8000, '8,000', 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&h=400&fit=crop&q=80',
         ARRAY['https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&h=400&fit=crop&q=80','https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=600&h=400&fit=crop&q=80','https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&h=400&fit=crop&q=80'],
         ARRAY['Private Pool', 'Butler Service', 'Jacuzzi'])
      `;
    }

    // Seed reviews if empty
    const existingReviews = await sql`SELECT COUNT(*) as count FROM reviews`;
    if (parseInt(existingReviews[0].count) === 0) {
      await sql`
        INSERT INTO reviews (name, text, rating) VALUES
        ('Rajesh Kumar', 'Absolutely luxurious! The Royal Suite was breathtaking.', 5),
        ('Sita Devi', 'The best hotel in town. Traditional Nepali hospitality at its finest.', 4),
        ('John Smith', 'World-class amenities. Will definitely come back.', 5)
      `;
    }

    // Add gallery column if it doesn't exist (for existing databases)
    try {
      await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS gallery TEXT[]`;
    } catch (e) { /* column may already exist */ }

    // Add rating column to reviews if missing
    try {
      await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 5`;
    } catch (e) { /* column may already exist */ }

    // Add dob/govt_id columns to bookings if missing
    try {
      await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dob DATE`;
      await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS govt_id_name VARCHAR(255)`;
      await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS govt_id_data TEXT`;
    } catch (e) { /* columns may already exist */ }

    return new Response(JSON.stringify({ success: true, message: 'Database initialized successfully!' }), {
      status: 200,
      headers
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers
    });
  }
};
