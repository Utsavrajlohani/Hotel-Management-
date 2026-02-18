const API_BASE = '/.netlify/functions';

// Loading spinner helpers
function showLoading() { document.getElementById('loading-overlay').classList.add('active'); }
function hideLoading() { document.getElementById('loading-overlay').classList.remove('active'); }

document.addEventListener('DOMContentLoaded', async () => {

    // --- Register Service Worker (PWA) ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(e => console.log('SW:', e));
    }

    // --- PWA Install Prompt ---
    let deferredPrompt = null;
    const installBanner = document.getElementById('pwa-install-banner');
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBanner.style.display = 'block';
    });
    installBanner.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
            installBanner.style.display = 'none';
        }
    });

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

    // --- Session Management ---
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

    if (isLoggedIn) updateLoginUI();

    // --- Coupon / Promo Codes ---
    const COUPONS = {
        'WELCOME10': { discount: 10, type: 'percent', label: '10% Off' },
        'FLAT500': { discount: 500, type: 'flat', label: '₹500 Off' },
        'LUXURY20': { discount: 20, type: 'percent', label: '20% Off' },
        'GRAND15': { discount: 15, type: 'percent', label: '15% Off' }
    };
    let appliedCoupon = null;

    document.getElementById('apply-coupon-btn').addEventListener('click', () => {
        const code = document.getElementById('coupon-code').value.trim().toUpperCase();
        const msgEl = document.getElementById('coupon-msg');
        if (COUPONS[code]) {
            appliedCoupon = { code, ...COUPONS[code] };
            msgEl.textContent = `✅ Coupon "${code}" applied! ${appliedCoupon.label}`;
            msgEl.style.display = 'block';
            msgEl.style.color = '#27ae60';
            showToast(`Coupon "${code}" applied — ${appliedCoupon.label}`);
        } else {
            appliedCoupon = null;
            msgEl.textContent = '❌ Invalid coupon code';
            msgEl.style.display = 'block';
            msgEl.style.color = '#e74c3c';
        }
    });

    // --- Seasonal Pricing ---
    function getSeasonMultiplier() {
        const month = new Date().getMonth() + 1; // 1-12
        // Peak: Oct-Dec (Dashain/Tihar/Christmas/NYE), Mar-Apr (Spring)
        if ([10, 11, 12, 3, 4].includes(month)) return 1.25;
        // Off-season: Jun-Aug (monsoon)
        if ([6, 7, 8].includes(month)) return 0.85;
        return 1.0;
    }

    function getSeasonLabel() {
        const m = getSeasonMultiplier();
        if (m > 1) return '🔥 Peak Season (+25%)';
        if (m < 1) return '💧 Off-Season (-15%)';
        return '';
    }

    // --- Rooms Data ---
    let allRooms = roomsData;
    let compareList = [];

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

    // --- Room Rendering with Gallery, Compare Checkbox, Seasonal Price ---
    const roomsGrid = document.getElementById('rooms-grid');

    function renderRooms(rooms) {
        roomsGrid.innerHTML = '';
        if (rooms.length === 0) {
            roomsGrid.innerHTML = '<p style="text-align:center;grid-column:1/-1;font-size:1.3rem;color:#888;">No rooms match your filters.</p>';
            return;
        }
        const seasonMult = getSeasonMultiplier();
        const seasonLabel = getSeasonLabel();

        rooms.forEach(room => {
            const gallery = room.gallery || [room.image];
            const seasonPrice = Math.round(room.price * seasonMult);
            const card = document.createElement('div');
            card.className = 'room-card reveal active';
            card.innerHTML = `
                <div class="room-image" data-index="0">
                    <img src="${gallery[0]}" alt="${room.name}" loading="lazy">
                    <label class="compare-checkbox" title="Compare"><input type="checkbox" data-room-id="${room.id}" ${compareList.includes(room.id) ? 'checked' : ''}></label>
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
                    <p class="room-price">₹${seasonPrice.toLocaleString()} / night ${seasonLabel ? `<small>${seasonLabel}</small>` : ''}</p>
                    <p>${(room.amenities || []).join(' • ')}</p>
                    <button class="btn btn-primary book-room-btn" data-room="${room.name}" data-price="${seasonPrice}">Book Now</button>
                </div>
            `;
            card.querySelector('.room-image').dataset.gallery = JSON.stringify(gallery);
            roomsGrid.appendChild(card);
        });

        // LazyLoad via IntersectionObserver
        const lazyImages = roomsGrid.querySelectorAll('img[loading="lazy"]');
        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.src; // trigger load
                        io.unobserve(img);
                    }
                });
            });
            lazyImages.forEach(img => io.observe(img));
        }

        // Compare checkboxes
        roomsGrid.querySelectorAll('.compare-checkbox input').forEach(cb => {
            cb.addEventListener('change', () => {
                const roomId = parseInt(cb.dataset.roomId);
                if (cb.checked) {
                    if (compareList.length >= 3) {
                        cb.checked = false;
                        showToast('You can compare up to 3 rooms only.', 'error');
                        return;
                    }
                    compareList.push(roomId);
                } else {
                    compareList = compareList.filter(id => id !== roomId);
                }
                document.getElementById('compare-rooms-btn').style.display = compareList.length >= 2 ? 'inline-block' : 'none';
            });
        });

        // Booking handlers
        document.querySelectorAll('.book-room-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!isLoggedIn) {
                    showToast('Please login first to book a room.', 'error');
                    loginModal.style.display = 'block';
                    return;
                }
                document.getElementById('booking-room-name').innerText = `Booking: ${btn.dataset.room}`;
                document.getElementById('booking-room-name').dataset.price = btn.dataset.price;
                bookingModal.style.display = 'block';
            });
        });
    }

    // Gallery carousel
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

    // --- Room Comparison ---
    document.getElementById('compare-rooms-btn').addEventListener('click', () => {
        const rooms = allRooms.filter(r => compareList.includes(r.id));
        if (rooms.length < 2) { showToast('Select at least 2 rooms to compare', 'error'); return; }
        const seasonMult = getSeasonMultiplier();
        let html = `<table class="compare-table"><thead><tr><th>Feature</th>`;
        rooms.forEach(r => html += `<th>${r.name}</th>`);
        html += `</tr></thead><tbody>`;
        html += `<tr><td><strong>Photo</strong></td>${rooms.map(r => `<td><img src="${r.image}" alt="${r.name}"></td>`).join('')}</tr>`;
        html += `<tr><td><strong>Price/Night</strong></td>${rooms.map(r => `<td>₹${Math.round(r.price * seasonMult).toLocaleString()}</td>`).join('')}</tr>`;
        html += `<tr><td><strong>Amenities</strong></td>${rooms.map(r => `<td>${(r.amenities || []).join('<br>')}</td>`).join('')}</tr>`;
        html += `</tbody></table>`;
        document.getElementById('compare-table-container').innerHTML = html;
        document.getElementById('compare-modal').style.display = 'block';
    });

    // --- Room Filters ---
    const filterPrice = document.getElementById('filter-price');
    const filterAmenity = document.getElementById('filter-amenity');
    const filterSearch = document.getElementById('filter-search');

    function applyFilters() {
        let filtered = [...allRooms];
        const priceVal = filterPrice.value;
        if (priceVal !== 'all') {
            const [min, max] = priceVal.split('-').map(Number);
            filtered = filtered.filter(r => r.price >= min && r.price <= max);
        }
        const amenityVal = filterAmenity.value;
        if (amenityVal !== 'all') {
            filtered = filtered.filter(r => r.amenities && r.amenities.includes(amenityVal));
        }
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
        } catch (e) { console.warn('Using local reviews'); }
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

    starRating.querySelectorAll('i').forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.value);
            ratingInput.value = selectedRating;
            starRating.querySelectorAll('i').forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.value) <= selectedRating);
            });
        });
    });
    starRating.querySelectorAll('i').forEach(s => s.classList.add('active'));

    // --- Init ---
    await loadRooms();
    await loadReviews();

    // --- Modals ---
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    const bookingModal = document.getElementById('booking-modal');
    const profileModal = document.getElementById('profile-modal');
    const compareModal = document.getElementById('compare-modal');

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

    // --- Registration ---
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
            } else {
                showToast(res.error || 'Registration failed!', 'error');
            }
        } catch (err) {
            localStorage.setItem('registeredUser', JSON.stringify({ name, phone, password }));
            showToast(`Registered (offline). Welcome, ${name}!`);
            saveSession({ name, phone });
            registerModal.style.display = 'none';
            updateLoginUI();
        }
        hideLoading();
    });

    // --- Login ---
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
                showToast(`Welcome back, ${currentUser.name}! (offline)`);
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

    // --- Lightbox ---
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

    // --- Date Validation (check-in/check-out) ---
    const checkinInput = document.getElementById('checkin-date');
    const checkoutInput = document.getElementById('checkout-date');
    const nightCountDiv = document.getElementById('night-count');

    // Set minimum check-in date to today
    const today = new Date().toISOString().split('T')[0];
    checkinInput.setAttribute('min', today);

    checkinInput.addEventListener('change', () => {
        // Check-out must be at least 1 day after check-in
        const nextDay = new Date(checkinInput.value);
        nextDay.setDate(nextDay.getDate() + 1);
        checkoutInput.setAttribute('min', nextDay.toISOString().split('T')[0]);
        // Reset checkout if it's before new min
        if (checkoutInput.value && new Date(checkoutInput.value) <= new Date(checkinInput.value)) {
            checkoutInput.value = nextDay.toISOString().split('T')[0];
        }
        updateNightCount();
    });

    checkoutInput.addEventListener('change', updateNightCount);

    function updateNightCount() {
        if (checkinInput.value && checkoutInput.value) {
            const nights = Math.ceil((new Date(checkoutInput.value) - new Date(checkinInput.value)) / (1000 * 60 * 60 * 24));
            if (nights > 0) {
                const roomPriceEl = document.getElementById('booking-room-name');
                const pricePerNight = parseInt(roomPriceEl.dataset.price) || 0;
                const totalPrice = pricePerNight * nights;
                nightCountDiv.innerHTML = `🌙 <strong>${nights} Night${nights > 1 ? 's' : ''}</strong> × ₹${pricePerNight.toLocaleString()} = ₹<strong>${totalPrice.toLocaleString()}</strong>`;
                nightCountDiv.style.display = 'block';
            } else {
                nightCountDiv.style.display = 'none';
            }
        } else {
            nightCountDiv.style.display = 'none';
        }
    }

    // --- Payment Flow (with multi-night pricing, coupon, UPI, countdown, WhatsApp) ---
    const paymentModal = document.getElementById('payment-modal');
    let pendingBookingData = null;

    document.getElementById('booking-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('booking-name').value;
        const email = document.getElementById('booking-email').value;
        const dob = document.getElementById('booking-dob').value;
        const govt_id = document.getElementById('booking-govtid').value;
        const room = document.getElementById('booking-room-name').innerText.replace('Booking: ', '');
        const checkin = document.getElementById('checkin-date').value;
        const checkout = document.getElementById('checkout-date').value;

        // Validate dates
        if (new Date(checkin) < new Date(today)) {
            showToast('Check-in date cannot be in the past!', 'error');
            return;
        }
        if (new Date(checkout) <= new Date(checkin)) {
            showToast('Check-out must be after check-in!', 'error');
            return;
        }

        // Multi-night pricing
        const nights = Math.ceil((new Date(checkout) - new Date(checkin)) / (1000 * 60 * 60 * 24));
        const pricePerNight = parseInt(document.getElementById('booking-room-name').dataset.price) || 0;
        let totalPrice = pricePerNight * nights;

        // Apply coupon
        if (appliedCoupon) {
            if (appliedCoupon.type === 'percent') {
                totalPrice = Math.round(totalPrice * (1 - appliedCoupon.discount / 100));
            } else {
                totalPrice = Math.max(0, totalPrice - appliedCoupon.discount);
            }
        }

        // Update UPI QR
        const upiId = '8541030170@upi';
        const upiUrl = `upi://pay?pa=${upiId}&pn=GrandHotel&am=${totalPrice}&cu=INR`;
        const qrImg = document.querySelector('.qr-code img');
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`;
        document.getElementById('pay-amount').innerText = `₹${totalPrice.toLocaleString()} (${nights} night${nights > 1 ? 's' : ''}${appliedCoupon ? ' + ' + appliedCoupon.label : ''})`;

        pendingBookingData = { name, email, dob, govt_id, room, checkin, checkout, price: totalPrice, nights, status: 'Confirmed' };

        bookingModal.style.display = 'none';
        paymentModal.style.display = 'block';
    });

    document.getElementById('confirm-payment-btn').addEventListener('click', async () => {
        if (!pendingBookingData) return;
        showLoading();

        try {
            const res = await apiCall('bookings', 'POST', pendingBookingData);
            if (res.success) {
                showToast(`Booking Confirmed for ${pendingBookingData.name}! ₹${pendingBookingData.price.toLocaleString()}`);
                sendBookingEmail(
                    pendingBookingData.name, pendingBookingData.email,
                    pendingBookingData.room, pendingBookingData.checkin,
                    pendingBookingData.checkout, pendingBookingData.price
                );
                // WhatsApp notification to hotel
                sendWhatsAppNotification(pendingBookingData);
            } else {
                showToast('Booking saved but server issue.', 'error');
            }
        } catch (err) {
            const bookings = JSON.parse(localStorage.getItem('bookings')) || [];
            bookings.push({ id: Date.now(), ...pendingBookingData });
            localStorage.setItem('bookings', JSON.stringify(bookings));
            showToast(`Booking Confirmed (offline) for ${pendingBookingData.name}.`);
        }

        // Show Countdown Timer
        startCountdown(pendingBookingData.checkin);

        hideLoading();
        // Reset coupon
        appliedCoupon = null;
        document.getElementById('coupon-code').value = '';
        document.getElementById('coupon-msg').style.display = 'none';
        document.getElementById('night-count').style.display = 'none';
        document.getElementById('booking-form').reset();
        pendingBookingData = null;
    });

    // --- Booking Countdown Timer ---
    let countdownInterval = null;

    function startCountdown(checkinDate) {
        const countdownDiv = document.getElementById('booking-countdown');
        countdownDiv.style.display = 'block';

        if (countdownInterval) clearInterval(countdownInterval);

        countdownInterval = setInterval(() => {
            const now = new Date();
            const target = new Date(checkinDate + 'T14:00:00'); // 2 PM check-in
            const diff = target - now;

            if (diff <= 0) {
                clearInterval(countdownInterval);
                countdownDiv.innerHTML = '<h4 style="color:var(--primary-color);">🎉 Check-in time has arrived! Welcome!</h4>';
                return;
            }

            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            document.getElementById('cd-days').textContent = d;
            document.getElementById('cd-hours').textContent = h;
            document.getElementById('cd-mins').textContent = m;
            document.getElementById('cd-secs').textContent = s;
        }, 1000);
    }

    // --- WhatsApp Notification ---
    function sendWhatsAppNotification(booking) {
        const msg = `🏨 New Booking!\nName: ${booking.name}\nRoom: ${booking.room}\nCheck-in: ${booking.checkin}\nCheck-out: ${booking.checkout}\nAmount: ₹${booking.price.toLocaleString()}\nGovt ID: ${booking.govt_id || 'N/A'}`;
        const whatsappUrl = `https://wa.me/918541030170?text=${encodeURIComponent(msg)}`;
        window.open(whatsappUrl, '_blank');
    }

    // Close modals on outside click
    window.onclick = function (event) {
        [loginModal, registerModal, bookingModal, paymentModal, profileModal, compareModal].forEach(m => {
            if (event.target === m) m.style.display = 'none';
        });
    };

    // --- Inquiry Form ---
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
            showToast('Inquiry saved (offline).');
        }
        hideLoading();
        e.target.reset();
    });

    // --- Feedback / Review Form ---
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
        selectedRating = 5;
        ratingInput.value = 5;
        starRating.querySelectorAll('i').forEach(s => s.classList.add('active'));
    });

    // --- Email Confirmation (EmailJS) ---
    function sendBookingEmail(name, email, room, checkin, checkout, price) {
        try {
            if (typeof emailjs !== 'undefined' && email) {
                emailjs.send('service_hotel', 'template_booking', {
                    to_email: email, guest_name: name, room_type: room,
                    checkin_date: checkin, checkout_date: checkout,
                    amount: `₹${price}`
                }, 'YOUR_PUBLIC_KEY');
            }
        } catch (e) { console.log('EmailJS not configured:', e.message); }
    }

    // --- Scroll Animation ---
    const revealElements = document.querySelectorAll('.reveal');
    const revealOnScroll = () => {
        revealElements.forEach(el => {
            if (el.getBoundingClientRect().top < window.innerHeight - 100) el.classList.add('active');
        });
    };
    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll();

    // --- Language Selector ---
    document.getElementById('language-selector').addEventListener('change', (e) => {
        if (typeof updateLanguage === 'function') updateLanguage(e.target.value);
    });
});
