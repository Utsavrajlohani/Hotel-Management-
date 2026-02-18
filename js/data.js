// Room Data — multiple gallery images per room for carousel
const roomsData = [
    {
        id: 1,
        name: "Deluxe King Room",
        price: 2500,
        price_display: "2,500",
        image: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=600&h=400&fit=crop&q=80",
        gallery: [
            "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=600&h=400&fit=crop&q=80",
            "https://images.unsplash.com/photo-1590490360182-c33d955bc97c?w=600&h=400&fit=crop&q=80",
            "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=600&h=400&fit=crop&q=80"
        ],
        amenities: ["King Bed", "City View", "Free Wifi"]
    },
    {
        id: 2,
        name: "Executive Suite",
        price: 4500,
        price_display: "4,500",
        image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&h=400&fit=crop&q=80",
        gallery: [
            "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&h=400&fit=crop&q=80",
            "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=600&h=400&fit=crop&q=80",
            "https://images.unsplash.com/photo-1591088398332-8a7791972843?w=600&h=400&fit=crop&q=80"
        ],
        amenities: ["Living Area", "Ocean View", "Mini Bar"]
    },
    {
        id: 3,
        name: "Presidential Suite",
        price: 8000,
        price_display: "8,000",
        image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&h=400&fit=crop&q=80",
        gallery: [
            "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&h=400&fit=crop&q=80",
            "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=600&h=400&fit=crop&q=80",
            "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&h=400&fit=crop&q=80"
        ],
        amenities: ["Private Pool", "Butler Service", "Jacuzzi"]
    }
];

// Default Reviews
const reviewsData = [
    { name: "Rajesh Kumar", text: "Absolutely luxurious! The Royal Suite was breathtaking.", rating: 5 },
    { name: "Sita Devi", text: "The best hotel in town. Traditional Nepali hospitality at its finest.", rating: 4 },
    { name: "John Smith", text: "World-class amenities. Will definitely come back.", rating: 5 }
];
