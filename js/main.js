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

document.addEventListener('DOMContentLoaded', async () => {

    // --- Helper: API Call ---
    async function apiCall(endpoint, method = 'GET', body = null) {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) options.body = JSON.stringify(body);
        const res = await fetch(`${API_BASE}/${endpoint}`, options);
        return res.json();
    }

    // --- Render Rooms ---
    const roomsGrid = document.getElementById('rooms-grid');

    async function loadRooms() {
        let rooms = roomsData; // fallback from data.js
        try {
            const res = await apiCall('rooms');
            if (res.success && res.rooms.length > 0) {
                rooms = res.rooms.map(r => ({
                    ...r,
                    price: r.price_display || r.price.toLocaleString(),
                    image: r.image,
                    amenities: r.amenities
                }));
            }
        } catch (e) {
            console.warn('API unavailable, using local room data:', e.message);
        }

        roomsGrid.innerHTML = rooms.map(room => `
            <div class="room-card reveal">
                <div class="room-image">
                    <img src="${room.image}" alt="${room.name}">
                </div>
                <div class="room-details">
                    <h4>${room.name}</h4>
                    <div class="room-price">₹${room.price}</div>
                    <ul>
                        ${room.amenities.map(a => `<li><i class="fas fa-check"></i> ${a}</li>`).join('')}
                    </ul>
                    <button class="btn btn-outline" onclick="openBookingModal('${room.name}')" data-i18n="btn_book">Book Now</button>
                </div>
            </div>
        `).join('');

        // Re-apply scroll reveal after rendering
        initScrollReveal();
    }

    await loadRooms();

    // --- Render Reviews ---
    const reviewsGrid = document.getElementById('reviews-grid');

    async function loadReviews() {
        let reviews = reviewsData; // fallback from data.js
        try {
            const res = await apiCall('reviews');
            if (res.success && res.reviews.length > 0) {
                reviews = res.reviews;
            }
        } catch (e) {
            console.warn('API unavailable, using local review data:', e.message);
        }

        reviewsGrid.innerHTML = '';
        reviews.forEach(review => {
            const card = document.createElement('div');
            card.classList.add('review-card');
            const rating = review.rating || 5;
            card.innerHTML = `
                <div class="review-header">
                    <strong>${review.name}</strong>
                    <div class="review-rating">
                        ${'<i class="fas fa-star"></i>'.repeat(rating)}
                    </div>
                </div>
                <p>"${review.text}"</p>
            `;
            reviewsGrid.appendChild(card);
        });
    }

    await loadReviews();

    // --- Language Switcher ---
    const langSelector = document.getElementById('language-selector');
    const savedLang = localStorage.getItem('hotel-lang') || 'en';
    langSelector.value = savedLang;
    updateLanguage(savedLang);

    langSelector.addEventListener('change', (e) => {
        updateLanguage(e.target.value);
    });

    // --- Mobile Menu ---
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });

    // --- Modals ---
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    const bookingModal = document.getElementById('booking-modal');
    const closeButtons = document.querySelectorAll('.close-modal');

    // Auth State
    let isLoggedIn = false;
    let currentUser = null;

    // Date Logic
    const checkinInput = document.getElementById('checkin-date');
    const checkoutInput = document.getElementById('checkout-date');

    const today = new Date();
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);

    const formatDate = (date) => date.toISOString().split('T')[0];

    checkinInput.min = formatDate(today);
    checkinInput.max = formatDate(maxDate);

    checkinInput.addEventListener('change', () => {
        checkoutInput.min = checkinInput.value;
        checkoutInput.max = formatDate(maxDate);
    });

    // Logic to open modals
    document.getElementById('login-btn').addEventListener('click', () => {
        if (isLoggedIn) return;
        loginModal.style.display = 'block';
    });

    document.getElementById('register-btn').addEventListener('click', () => {
        registerModal.style.display = 'block';
    });

    // Global function for booking button
    window.openBookingModal = function (roomName) {
        if (!isLoggedIn) {
            showToast("Please Login to book a room.", 'error');
            loginModal.style.display = 'block';
            return;
        }
        const modal = document.getElementById('booking-modal');
        document.getElementById('booking-room-name').innerText = `Booking: ${roomName}`;
        if (currentUser) {
            document.getElementById('booking-name').value = currentUser.name;
        }
        modal.style.display = 'block';
    }

    // Close Modals
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            loginModal.style.display = 'none';
            registerModal.style.display = 'none';
            bookingModal.style.display = 'none';
        });
    });

    window.onclick = function (event) {
        if (event.target == loginModal) loginModal.style.display = "none";
        if (event.target == registerModal) registerModal.style.display = "none";
        if (event.target == bookingModal) bookingModal.style.display = "none";
    }

    // --- Toast Notification ---
    const showToast = (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> <span>${message}</span>`;
        container.appendChild(toast);

        void toast.offsetWidth;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    // --- Registration Handler (API) ---
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const phone = document.getElementById('reg-phone').value;
        const password = document.getElementById('reg-password').value;

        try {
            const res = await apiCall('users', 'POST', { action: 'register', name, phone, password });
            if (res.success) {
                showToast('Registration Successful! Please Login.');
                registerModal.style.display = 'none';
                loginModal.style.display = 'block';
            } else {
                showToast(res.error || 'Registration failed!', 'error');
            }
        } catch (err) {
            // Fallback to localStorage
            localStorage.setItem('registeredUser', JSON.stringify({ name, phone, password }));
            showToast('Registration Successful (offline mode)! Please Login.');
            registerModal.style.display = 'none';
            loginModal.style.display = 'block';
        }
    });

    // --- Login Handler (API) ---
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = document.getElementById('login-phone').value;
        const password = document.getElementById('login-password').value;

        try {
            const res = await apiCall('users', 'POST', { action: 'login', phone, password });
            if (res.success) {
                currentUser = res.user;
                isLoggedIn = true;
                showToast(`Welcome back, ${currentUser.name}!`);
                loginModal.style.display = 'none';
                updateLoginUI();
            } else {
                showToast(res.error || 'Invalid Credentials!', 'error');
            }
        } catch (err) {
            // Fallback to localStorage
            const storedUser = JSON.parse(localStorage.getItem('registeredUser'));
            if (storedUser && storedUser.phone === phone && storedUser.password === password) {
                currentUser = storedUser;
                isLoggedIn = true;
                showToast(`Welcome back, ${currentUser.name}! (offline mode)`);
                loginModal.style.display = 'none';
                updateLoginUI();
            } else {
                showToast('Invalid Credentials!', 'error');
            }
        }
    });

    function updateLoginUI() {
        const loginBtn = document.getElementById('login-btn');
        loginBtn.innerText = currentUser.name;
        loginBtn.classList.remove('btn-outline');
        loginBtn.classList.add('btn-secondary');
        document.getElementById('register-btn').style.display = 'none';
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
        if (e.target.tagName === 'IMG') {
            lightbox.style.display = 'flex';
            lightboxImg.src = e.target.src;
        }
    });

    document.querySelector('.lightbox-close').addEventListener('click', () => {
        lightbox.style.display = 'none';
    });

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) lightbox.style.display = 'none';
    });

    // --- Payment Flow (Modified Booking) ---
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

        document.getElementById('pay-amount').innerText = `₹${price}`;

        pendingBookingData = { name, email, dob, govt_id_name, govt_id_data, room, checkin, checkout, price, status: 'Confirmed' };

        bookingModal.style.display = 'none';
        paymentModal.style.display = 'block';
    });

    document.getElementById('confirm-payment-btn').addEventListener('click', async () => {
        if (!pendingBookingData) return;

        try {
            const res = await apiCall('bookings', 'POST', pendingBookingData);
            if (res.success) {
                showToast(`Payment Received! Booking Confirmed for ${pendingBookingData.name}.`);
            } else {
                showToast('Booking saved but there was a server issue.', 'error');
            }
        } catch (err) {
            // Fallback to localStorage
            const bookings = JSON.parse(localStorage.getItem('bookings')) || [];
            bookings.push({ id: Date.now(), ...pendingBookingData });
            localStorage.setItem('bookings', JSON.stringify(bookings));
            showToast(`Booking Confirmed (offline mode) for ${pendingBookingData.name}.`);
        }

        paymentModal.style.display = 'none';
        document.getElementById('booking-form').reset();
        pendingBookingData = null;
    });

    // Add payment modal to close logic
    window.onclick = function (event) {
        if (event.target == loginModal) loginModal.style.display = "none";
        if (event.target == registerModal) registerModal.style.display = "none";
        if (event.target == bookingModal) bookingModal.style.display = "none";
        if (event.target == paymentModal) paymentModal.style.display = "none";
    }

    // --- Inquiry Form (API) ---
    document.getElementById('inquiry-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = e.target.querySelector('input[type="text"]').value;
        const email = e.target.querySelector('input[type="email"]').value;
        const message = e.target.querySelector('textarea').value;

        try {
            await apiCall('inquiries', 'POST', { name, email, message });
            showToast('Inquiry Sent! We will contact you soon.');
        } catch (err) {
            // Fallback to localStorage
            const inquiries = JSON.parse(localStorage.getItem('inquiries')) || [];
            inquiries.push({ id: Date.now(), name, email, message, date: new Date().toLocaleDateString() });
            localStorage.setItem('inquiries', JSON.stringify(inquiries));
            showToast('Inquiry Sent (offline mode)! We will contact you soon.');
        }
        e.target.reset();
    });

    // --- Feedback / Review Form (API) ---
    document.getElementById('feedback-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('feedback-name').value;
        const text = document.getElementById('feedback-text').value;

        try {
            await apiCall('reviews', 'POST', { name, text, rating: 5 });
            showToast('Thank you for your feedback!');
            // Reload reviews to show the new one
            await loadReviews();
        } catch (err) {
            showToast('Thank you for your feedback! (saved offline)');
        }
        e.target.reset();
    });

    // --- Scroll Animations ---
    function initScrollReveal() {
        const revealElements = document.querySelectorAll('.reveal');

        const revealOnScroll = () => {
            const windowHeight = window.innerHeight;
            const elementVisible = 50;

            revealElements.forEach((reveal) => {
                const elementTop = reveal.getBoundingClientRect().top;
                if (elementTop < windowHeight - elementVisible) {
                    reveal.classList.add('active');
                }
            });
        }

        window.addEventListener('scroll', revealOnScroll);
        revealOnScroll();
    }

    initScrollReveal();
});
