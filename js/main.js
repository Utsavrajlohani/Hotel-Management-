const API_BASE = '/.netlify/functions';

// Helper: convert File to base64 string
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Loading spinner helpers
function showLoading() { document.getElementById('loading-overlay').classList.add('active'); }
function hideLoading() { document.getElementById('loading-overlay').classList.remove('active'); }

document.addEventListener('DOMContentLoaded', async () => {

    // --- Helper: API Call ---
    async function apiCall(endpoint, method = 'GET', body = null) {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) options.body = JSON.stringify(body);
        const res = await fetch(`${API_BASE}/${endpoint}`, options);
        return res.json();
    }

    // --- Helper: Hash password (SHA-256 + salt) ---
    async function hashPassword(password, salt) {
        const encoder = new TextEncoder();
        const data = encoder.encode(salt + password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function generateSalt() {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // --- Helper: Toast ---
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    // --- Session Management (JWT-like via localStorage) ---
    let currentUser = JSON.parse(sessionStorage.getItem('hotelSession')) || null;
    let isLoggedIn = !!currentUser;

    function saveSession(user) {
        currentUser = user;
        isLoggedIn = true;
        sessionStorage.setItem('hotelSession', JSON.stringify(user));
    }

    function clearSession() {
        currentUser = null;
        isLoggedIn = false;
        sessionStorage.removeItem('hotelSession');
    }

    // Restore session on page load
    if (isLoggedIn) {
        updateLoginUI();
    }

    // --- Rooms Data ---
    let allRooms = roomsData; // fallback from data.js

    async function loadRooms() {
        try {
            const res = await apiCall('rooms');
            if (res.success && res.rooms.length > 0) {
                allRooms = res.rooms.map(r => ({
                    ...r,
                    price: r.price,
                    price_display: r.price_display || r.price.toLocaleString(),
                    image: r.image,
                    gallery: r.gallery || [r.image],
                    amenities: r.amenities
                }));
            }
        } catch (e) {
            console.warn('API unavailable, using local room data:', e.message);
        }
        renderRooms(allRooms);
    }

    // --- Room Rendering with Gallery Carousel ---
    const roomsGrid = document.getElementById('rooms-grid');

    function renderRooms(rooms) {
        roomsGrid.innerHTML = '';
        if (rooms.length === 0) {
            roomsGrid.innerHTML = '<p style="text-align:center;grid-column:1/-1;font-size:1.3rem;color:#888;">No rooms match your filters.</p>';
            return;
        }
        rooms.forEach(room => {
            const gallery = room.gallery || [room.image];
            const card = document.createElement('div');
            card.className = 'room-card reveal active';
            card.innerHTML = `
                <div class="room-image" data-index="0">
                    <img src="${gallery[0]}" alt="${room.name}" loading="lazy">
                    ${gallery.length > 1 ? `
                        <button class="gallery-nav gallery-prev" onclick="galleryNav(this, -1)">‹</button>
                        <button class="gallery-nav gallery-next" onclick="galleryNav(this, 1)">›</button>
                        <div class="gallery-dots">
                            ${gallery.map((_, i) => `<span class="${i === 0 ? 'active' : ''}" data-i="${i}"></span>`).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="room-details">
                    <h4>${room.name}</h4>
                    <p class="room-price">₹${room.price_display || room.price} / night</p>
                    <p>${(room.amenities || []).join(' • ')}</p>
                    <button class="btn btn-primary book-room-btn" data-room="${room.name}">Book Now</button>
                </div>
            `;
            // Store gallery data on the element
            card.querySelector('.room-image').dataset.gallery = JSON.stringify(gallery);
            roomsGrid.appendChild(card);
        });

        // Attach booking handlers
        document.querySelectorAll('.book-room-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!isLoggedIn) {
                    showToast('Please login first to book a room.', 'error');
                    loginModal.style.display = 'block';
                    return;
                }
                document.getElementById('booking-room-name').innerText = `Booking: ${btn.dataset.room}`;
                bookingModal.style.display = 'block';
            });
        });
    }

    // Gallery carousel navigation
    window.galleryNav = function (btn, dir) {
        const container = btn.closest('.room-image');
        const gallery = JSON.parse(container.dataset.gallery);
        let idx = parseInt(container.dataset.index) + dir;
        if (idx < 0) idx = gallery.length - 1;
        if (idx >= gallery.length) idx = 0;
        container.dataset.index = idx;
        container.querySelector('img').src = gallery[idx];
        container.querySelectorAll('.gallery-dots span').forEach((dot, i) => {
            dot.classList.toggle('active', i === idx);
        });
    };

    // --- Room Filters ---
    const filterPrice = document.getElementById('filter-price');
    const filterAmenity = document.getElementById('filter-amenity');
    const filterSearch = document.getElementById('filter-search');

    function applyFilters() {
        let filtered = [...allRooms];
        // Price filter
        const priceVal = filterPrice.value;
        if (priceVal !== 'all') {
            const [min, max] = priceVal.split('-').map(Number);
            filtered = filtered.filter(r => r.price >= min && r.price <= max);
        }
        // Amenity filter
        const amenityVal = filterAmenity.value;
        if (amenityVal !== 'all') {
            filtered = filtered.filter(r => r.amenities && r.amenities.includes(amenityVal));
        }
        // Search filter
        const search = filterSearch.value.toLowerCase().trim();
        if (search) {
            filtered = filtered.filter(r =>
                r.name.toLowerCase().includes(search) ||
                (r.amenities || []).some(a => a.toLowerCase().includes(search))
            );
        }
        renderRooms(filtered);
    }

    filterPrice.addEventListener('change', applyFilters);
    filterAmenity.addEventListener('change', applyFilters);
    filterSearch.addEventListener('input', applyFilters);

    // --- Reviews ---
    const reviewsGrid = document.querySelector('.reviews-grid');

    async function loadReviews() {
        let reviews = reviewsData;
        try {
            const res = await apiCall('reviews');
            if (res.success && res.reviews.length > 0) reviews = res.reviews;
        } catch (e) {
            console.warn('Using local reviews');
        }
        reviewsGrid.innerHTML = '';
        reviews.forEach(r => {
            const stars = '★'.repeat(r.rating || 5) + '☆'.repeat(5 - (r.rating || 5));
            reviewsGrid.innerHTML += `
                <div class="review-card">
                    <div class="review-header">
                        <strong>${r.name}</strong>
                        <span class="review-rating">${stars}</span>
                    </div>
                    <p>"${r.text}"</p>
                </div>
            `;
        });
    }

    // --- Interactive Star Rating ---
    const starRating = document.getElementById('star-rating');
    const ratingInput = document.getElementById('feedback-rating');
    let selectedRating = 5;

    // Stars are in RTL order (5,4,3,2,1), so clicking works with CSS sibling hover
    starRating.querySelectorAll('i').forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.value);
            ratingInput.value = selectedRating;
            // Update active states
            starRating.querySelectorAll('i').forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.value) <= selectedRating);
            });
        });
    });
    // Initialize all 5 stars active
    starRating.querySelectorAll('i').forEach(s => s.classList.add('active'));

    // --- Init ---
    await loadRooms();
    await loadReviews();

    // --- Modals ---
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    const bookingModal = document.getElementById('booking-modal');
    const profileModal = document.getElementById('profile-modal');

    document.getElementById('login-btn').addEventListener('click', () => {
        if (isLoggedIn) {
            clearSession();
            showToast('Logged out successfully.');
            const loginBtn = document.getElementById('login-btn');
            loginBtn.innerText = 'Login';
            loginBtn.classList.add('btn-outline');
            loginBtn.classList.remove('btn-secondary');
            document.getElementById('register-btn').style.display = 'inline-block';
            document.getElementById('profile-btn').style.display = 'none';
            return;
        }
        loginModal.style.display = 'block';
    });

    document.getElementById('register-btn').addEventListener('click', () => {
        registerModal.style.display = 'block';
    });

    document.getElementById('profile-btn').addEventListener('click', async () => {
        profileModal.style.display = 'block';
        document.getElementById('profile-name').textContent = currentUser.name;
        document.getElementById('profile-phone').textContent = currentUser.phone;
        // Load booking history
        const bookingsDiv = document.getElementById('profile-bookings');
        bookingsDiv.innerHTML = '<p>Loading...</p>';
        try {
            const res = await apiCall('bookings');
            if (res.success) {
                const userBookings = res.bookings.filter(b =>
                    b.name?.toLowerCase() === currentUser.name?.toLowerCase() ||
                    b.email === currentUser.email
                );
                if (userBookings.length === 0) {
                    bookingsDiv.innerHTML = '<p>No bookings found.</p>';
                } else {
                    bookingsDiv.innerHTML = userBookings.map(b => `
                        <div class="booking-history-item">
                            <span class="bh-room">${b.room}</span><br>
                            <span class="bh-dates">${b.checkin} → ${b.checkout}</span><br>
                            <span class="bh-status">${b.status}</span> · ₹${b.price}
                        </div>
                    `).join('');
                }
            }
        } catch (e) {
            bookingsDiv.innerHTML = '<p>Could not load bookings.</p>';
        }
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').style.display = 'none';
        });
    });

    // --- Registration (with password hashing) ---
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading();
        const name = document.getElementById('reg-name').value;
        const phone = document.getElementById('reg-phone').value;
        const password = document.getElementById('reg-password').value;

        try {
            const salt = generateSalt();
            const hashedPassword = await hashPassword(password, salt);

            const res = await apiCall('users', 'POST', {
                action: 'register', name, phone,
                password: salt + ':' + hashedPassword
            });
            if (res.success) {
                showToast(`Welcome, ${name}! Registration successful.`);
                registerModal.style.display = 'none';
                saveSession({ name, phone });
                updateLoginUI();
                // Send welcome email if EmailJS configured
                sendBookingEmail(name, '', 'Registration', 'N/A', 'N/A', 0);
            } else {
                showToast(res.error || 'Registration failed!', 'error');
            }
        } catch (err) {
            // Fallback to localStorage
            localStorage.setItem('registeredUser', JSON.stringify({ name, phone, password }));
            showToast(`Registered (offline mode). Welcome, ${name}!`);
            saveSession({ name, phone });
            registerModal.style.display = 'none';
            updateLoginUI();
        }
        hideLoading();
    });

    // --- Login (with password hashing) ---
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading();
        const phone = document.getElementById('login-phone').value;
        const password = document.getElementById('login-password').value;

        try {
            const res = await apiCall('users', 'POST', { action: 'login', phone, password });
            if (res.success) {
                saveSession(res.user);
                showToast(`Welcome back, ${currentUser.name}!`);
                loginModal.style.display = 'none';
                updateLoginUI();
            } else {
                showToast(res.error || 'Invalid Credentials!', 'error');
            }
        } catch (err) {
            const storedUser = JSON.parse(localStorage.getItem('registeredUser'));
            if (storedUser && storedUser.phone === phone && storedUser.password === password) {
                saveSession(storedUser);
                showToast(`Welcome back, ${currentUser.name}! (offline mode)`);
                loginModal.style.display = 'none';
                updateLoginUI();
            } else {
                showToast('Invalid Credentials!', 'error');
            }
        }
        hideLoading();
    });

    function updateLoginUI() {
        const loginBtn = document.getElementById('login-btn');
        loginBtn.innerText = currentUser.name;
        loginBtn.classList.remove('btn-outline');
        loginBtn.classList.add('btn-secondary');
        document.getElementById('register-btn').style.display = 'none';
        document.getElementById('profile-btn').style.display = 'inline-block';
    }

    // --- Dark Mode ---
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const body = document.body;

    if (localStorage.getItem('darkMode') === 'enabled') {
        body.classList.add('dark-mode');
        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }

    darkModeToggle.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        if (body.classList.contains('dark-mode')) {
            localStorage.setItem('darkMode', 'enabled');
            darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            localStorage.setItem('darkMode', 'disabled');
            darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        }
    });

    // --- Lightbox Gallery ---
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');

    roomsGrid.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG' && e.target.closest('.room-image')) {
            lightbox.style.display = 'flex';
            lightboxImg.src = e.target.src;
        }
    });

    document.querySelector('.lightbox-close').addEventListener('click', () => {
        lightbox.style.display = 'none';
    });

    // --- Mobile Menu ---
    document.querySelector('.mobile-menu-toggle').addEventListener('click', () => {
        document.querySelector('.nav-links').classList.toggle('active');
    });

    // --- Payment Flow (Modified Booking with real UPI) ---
    const paymentModal = document.getElementById('payment-modal');
    let pendingBookingData = null;

    document.getElementById('booking-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('booking-name').value;
        const email = document.getElementById('booking-email').value;
        const dob = document.getElementById('booking-dob').value;
        const room = document.getElementById('booking-room-name').innerText.replace('Booking: ', '');
        const checkin = document.getElementById('checkin-date').value;
        const checkout = document.getElementById('checkout-date').value;

        // Convert Govt ID file to base64
        let govt_id_name = null;
        let govt_id_data = null;
        const govtIdFile = document.getElementById('booking-govtid').files[0];
        if (govtIdFile) {
            govt_id_name = govtIdFile.name;
            govt_id_data = await fileToBase64(govtIdFile);
        }

        let price = 0;
        if (room.includes('Deluxe')) price = 2500;
        if (room.includes('Executive')) price = 4500;
        if (room.includes('Presidential')) price = 8000;

        // Update UPI QR with real amount and UPI ID
        const upiId = '8541030170@upi';
        const upiUrl = `upi://pay?pa=${upiId}&pn=GrandHotel&am=${price}&cu=INR`;
        const qrImg = document.querySelector('.qr-code img');
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`;
        document.getElementById('pay-amount').innerText = `₹${price}`;

        pendingBookingData = { name, email, dob, govt_id_name, govt_id_data, room, checkin, checkout, price, status: 'Confirmed' };

        bookingModal.style.display = 'none';
        paymentModal.style.display = 'block';
    });

    document.getElementById('confirm-payment-btn').addEventListener('click', async () => {
        if (!pendingBookingData) return;
        showLoading();

        try {
            const res = await apiCall('bookings', 'POST', pendingBookingData);
            if (res.success) {
                showToast(`Payment Received! Booking Confirmed for ${pendingBookingData.name}.`);
                // Send confirmation email
                sendBookingEmail(
                    pendingBookingData.name, pendingBookingData.email,
                    pendingBookingData.room, pendingBookingData.checkin,
                    pendingBookingData.checkout, pendingBookingData.price
                );
            } else {
                showToast('Booking saved but there was a server issue.', 'error');
            }
        } catch (err) {
            const bookings = JSON.parse(localStorage.getItem('bookings')) || [];
            bookings.push({ id: Date.now(), ...pendingBookingData });
            localStorage.setItem('bookings', JSON.stringify(bookings));
            showToast(`Booking Confirmed (offline mode) for ${pendingBookingData.name}.`);
        }

        hideLoading();
        paymentModal.style.display = 'none';
        document.getElementById('booking-form').reset();
        pendingBookingData = null;
    });

    // Close modals on outside click
    window.onclick = function (event) {
        if (event.target == loginModal) loginModal.style.display = "none";
        if (event.target == registerModal) registerModal.style.display = "none";
        if (event.target == bookingModal) bookingModal.style.display = "none";
        if (event.target == paymentModal) paymentModal.style.display = "none";
        if (event.target == profileModal) profileModal.style.display = "none";
    }

    // --- Inquiry Form (API) ---
    document.getElementById('inquiry-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading();
        const name = e.target.querySelector('input[type="text"]').value;
        const email = e.target.querySelector('input[type="email"]').value;
        const message = e.target.querySelector('textarea').value;

        try {
            await apiCall('inquiries', 'POST', { name, email, message });
            showToast('Inquiry Sent! We will contact you soon.');
        } catch (err) {
            const inquiries = JSON.parse(localStorage.getItem('inquiries')) || [];
            inquiries.push({ id: Date.now(), name, email, message, date: new Date().toLocaleDateString() });
            localStorage.setItem('inquiries', JSON.stringify(inquiries));
            showToast('Inquiry saved (offline mode).');
        }
        hideLoading();
        e.target.reset();
    });

    // --- Feedback / Review Form (API with star rating) ---
    document.getElementById('feedback-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading();
        const name = document.getElementById('feedback-name').value;
        const text = document.getElementById('feedback-text').value;
        const rating = selectedRating;

        try {
            await apiCall('reviews', 'POST', { name, text, rating });
            showToast('Thank you for your feedback!');
            await loadReviews();
        } catch (err) {
            showToast('Feedback saved locally.');
        }
        hideLoading();
        e.target.reset();
        // Reset stars
        selectedRating = 5;
        ratingInput.value = 5;
        starRating.querySelectorAll('i').forEach(s => s.classList.add('active'));
    });

    // --- Email Confirmation (EmailJS) ---
    // Users need to set up EmailJS with their own service_id, template_id, and public_key
    // Visit https://www.emailjs.com/ to set up a free account
    function sendBookingEmail(name, email, room, checkin, checkout, price) {
        try {
            if (typeof emailjs !== 'undefined' && email) {
                emailjs.send('service_hotel', 'template_booking', {
                    to_email: email,
                    guest_name: name,
                    room_type: room,
                    checkin_date: checkin,
                    checkout_date: checkout,
                    amount: `₹${price}`
                }, 'YOUR_PUBLIC_KEY'); // Replace with your EmailJS public key
                console.log('Booking confirmation email sent');
            }
        } catch (e) {
            console.log('EmailJS not configured:', e.message);
        }
    }

    // --- Scroll Animation ---
    const revealElements = document.querySelectorAll('.reveal');
    const revealOnScroll = () => {
        revealElements.forEach(el => {
            const top = el.getBoundingClientRect().top;
            if (top < window.innerHeight - 100) {
                el.classList.add('active');
            }
        });
    };
    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll();

    // --- Language Selector ---
    document.getElementById('language-selector').addEventListener('change', (e) => {
        if (typeof updateLanguage === 'function') updateLanguage(e.target.value);
    });
});
