document.addEventListener('DOMContentLoaded', () => {

    // --- Render Rooms ---
    const roomsGrid = document.getElementById('rooms-grid');
    roomsGrid.innerHTML = roomsData.map(room => `
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

    // --- Render Reviews ---
    const reviewsGrid = document.getElementById('reviews-grid');
    reviewsData.forEach(review => {
        const card = document.createElement('div');
        card.classList.add('review-card');
        card.innerHTML = `
            <div class="review-header">
                <strong>${review.name}</strong>
                <div class="review-rating">
                    ${'<i class="fas fa-star"></i>'.repeat(review.rating)}
                </div>
            </div>
            <p>"${review.text}"</p>
        `;
        reviewsGrid.appendChild(card);
    });

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
    let registeredUser = null; // { name, phone, password }

    // Date Logic
    const checkinInput = document.getElementById('checkin-date');
    const checkoutInput = document.getElementById('checkout-date');

    const today = new Date();
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);

    const formatDate = (date) => date.toISOString().split('T')[0];

    // Set constraints
    checkinInput.min = formatDate(today);
    checkinInput.max = formatDate(maxDate);

    // Checkout constraints update on checkin change
    checkinInput.addEventListener('change', () => {
        checkoutInput.min = checkinInput.value;
        const checkinDate = new Date(checkinInput.value);
        const maxCheckout = new Date(checkinDate);
        maxCheckout.setDate(maxCheckout.getDate() + 90); // Cap stay if needed, or just keep general max
        checkoutInput.max = formatDate(maxDate); // Keep global max
    });

    // Logic to open modals
    document.getElementById('login-btn').addEventListener('click', () => {
        if (isLoggedIn) return; // Or handle logout
        loginModal.style.display = 'block';
    });

    document.getElementById('register-btn').addEventListener('click', () => {
        registerModal.style.display = 'block';
    });

    // Global function for booking button
    window.openBookingModal = function (roomName) {
        if (!isLoggedIn) {
            alert("Please Login to book a room.");
            loginModal.style.display = 'block';
            return;
        }
        const modal = document.getElementById('booking-modal');
        document.getElementById('booking-room-name').innerText = `Booking: ${roomName}`;
        // Auto-fill available data
        if (registeredUser) {
            document.getElementById('booking-name').value = registeredUser.name;
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

    // --- Forms Handling ---

    // --- Toast Notification ---
    const showToast = (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> <span>${message}</span>`;
        container.appendChild(toast);

        // Trigger reflow
        void toast.offsetWidth;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    // --- Forms Handling ---

    // Registration Handler
    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const phone = document.getElementById('reg-phone').value;
        const password = document.getElementById('reg-password').value;

        // Simple mock registration
        registeredUser = { name, phone, password };
        localStorage.setItem('registeredUser', JSON.stringify(registeredUser));
        showToast('Registration Successful! Please Login.');
        registerModal.style.display = 'none';
        loginModal.style.display = 'block';
    });

    // Login Handler
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const phone = document.getElementById('login-phone').value;
        const password = document.getElementById('login-password').value;
        const storedUser = JSON.parse(localStorage.getItem('registeredUser'));

        // Validate against registered user
        if ((registeredUser && registeredUser.phone === phone && registeredUser.password === password) ||
            (storedUser && storedUser.phone === phone && storedUser.password === password)) {

            if (!registeredUser) registeredUser = storedUser;

            showToast(`Welcome back, ${registeredUser.name}!`);
            isLoggedIn = true;
            loginModal.style.display = 'none';

            // Update UI
            const loginBtn = document.getElementById('login-btn');
            loginBtn.innerText = registeredUser.name;
            loginBtn.classList.remove('btn-outline');
            loginBtn.classList.add('btn-secondary');

            document.getElementById('register-btn').style.display = 'none';
        } else {
            showToast('Invalid Credentials!', 'error');
        }
    });

    // --- Dark Mode ---
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const body = document.body;

    // Check local storage
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

    // Delegate click for dynamic rooms
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
    // Store current booking data temporarily
    let pendingBookingData = null;

    document.getElementById('booking-form').addEventListener('submit', (e) => {
        e.preventDefault();

        // Capture data
        const name = document.getElementById('booking-name').value;
        const email = document.getElementById('booking-email').value;
        const room = document.getElementById('booking-room-name').innerText.replace('Booking: ', '');
        const checkin = document.getElementById('checkin-date').value;
        const checkout = document.getElementById('checkout-date').value;

        // Calculate Amount (Mock)
        let price = registeredUser ? 0 : 0; // Just init
        if (room.includes('Deluxe')) price = 2500;
        if (room.includes('Executive')) price = 4500;
        if (room.includes('Presidential')) price = 8000;

        document.getElementById('pay-amount').innerText = `₹${price}`;

        pendingBookingData = {
            id: Date.now(),
            name,
            email,
            room,
            checkin,
            checkout,
            price,
            status: 'Confirmed'
        };

        // Close Booking, Open Payment
        bookingModal.style.display = 'none';
        paymentModal.style.display = 'block';
    });

    document.getElementById('confirm-payment-btn').addEventListener('click', () => {
        if (!pendingBookingData) return;

        const bookings = JSON.parse(localStorage.getItem('bookings')) || [];
        bookings.push(pendingBookingData);
        localStorage.setItem('bookings', JSON.stringify(bookings));

        showToast(`Payment Received! Booking Confirmed for ${pendingBookingData.name}.`);
        paymentModal.style.display = 'none';

        // Reset form
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

    document.getElementById('inquiry-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = e.target.querySelector('input[type="text"]').value;
        const email = e.target.querySelector('input[type="email"]').value;
        const message = e.target.querySelector('textarea').value;

        const inquiries = JSON.parse(localStorage.getItem('inquiries')) || [];
        inquiries.push({ id: Date.now(), name, email, message, date: new Date().toLocaleDateString() });
        localStorage.setItem('inquiries', JSON.stringify(inquiries));

        showToast('Inquiry Sent! We will contact you soon.');
        e.target.reset();
    });

    document.getElementById('feedback-form').addEventListener('submit', (e) => {
        e.preventDefault();
        showToast('Thank you for your feedback!');
        e.target.reset();
    });

    // --- Window Scope for Booking ---
    window.openBookingModal = function (roomName) {
        if (!isLoggedIn) {
            showToast("Please Login to book a room.", 'error');
            loginModal.style.display = 'block';
            return;
        }
        const modal = document.getElementById('booking-modal');
        document.getElementById('booking-room-name').innerText = `Booking: ${roomName}`;
        if (registeredUser) {
            document.getElementById('booking-name').value = registeredUser.name;
        }
        modal.style.display = 'block';
    }

    // --- Scroll Animations ---
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
    // Trigger once on load
    revealOnScroll();

});


