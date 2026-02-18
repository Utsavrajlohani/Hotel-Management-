const API_BASE = '/.netlify/functions';

document.addEventListener('DOMContentLoaded', () => {

    // --- Helper: API Call ---
    async function apiCall(endpoint, method = 'GET', body = null) {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) options.body = JSON.stringify(body);
        const res = await fetch(`${API_BASE}/${endpoint}`, options);
        return res.json();
    }

    // --- Admin Auth ---
    const overlay = document.getElementById('admin-login-overlay');
    const pinInput = document.getElementById('admin-pin');
    const loginBtn = document.getElementById('admin-login-btn');

    const checkLogin = () => {
        if (pinInput.value === '1234') {
            overlay.style.display = 'none';
            renderDashboard();
        } else {
            showToast('Invalid PIN', 'error');
            pinInput.value = '';
        }
    };

    loginBtn.addEventListener('click', checkLogin);
    pinInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') checkLogin();
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        overlay.style.display = 'flex';
        pinInput.value = '';
    });

    // --- Toast Logic ---
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

    // --- Tabs ---
    const tabs = document.querySelectorAll('.sidebar .menu li[data-tab]');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
            document.getElementById('page-title').innerText = tab.innerText.trim();
        });
    });

    // --- Render Logic (API-powered) ---
    async function renderDashboard() {
        let bookings = [];
        let inquiries = [];

        try {
            const bookingsRes = await apiCall('bookings');
            if (bookingsRes.success) bookings = bookingsRes.bookings;
        } catch (e) {
            // Fallback to localStorage
            bookings = JSON.parse(localStorage.getItem('bookings')) || [];
        }

        try {
            const inquiriesRes = await apiCall('inquiries');
            if (inquiriesRes.success) inquiries = inquiriesRes.inquiries;
        } catch (e) {
            inquiries = JSON.parse(localStorage.getItem('inquiries')) || [];
        }

        // Stats
        document.getElementById('total-bookings').innerText = bookings.length;
        document.getElementById('total-inquiries').innerText = inquiries.length;

        // Revenue
        let revenue = 0;
        bookings.forEach(b => {
            if (b.room && b.room.includes('Deluxe')) revenue += 2500;
            else if (b.room && b.room.includes('Executive')) revenue += 4500;
            else if (b.room && b.room.includes('Presidential')) revenue += 8000;
            else if (b.price) revenue += b.price;
        });
        document.getElementById('total-revenue').innerText = `₹${revenue.toLocaleString()}`;

        // Bookings Table
        const bookingsBody = document.getElementById('bookings-table-body');
        bookingsBody.innerHTML = bookings.map(b => `
            <tr>
                <td>#${String(b.id).slice(-4)}</td>
                <td>${b.name}</td>
                <td>${b.room}</td>
                <td>${b.checkin}</td>
                <td>${b.checkout}</td>
                <td><span style="color: green; font-weight: bold;">${b.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteBooking(${b.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');

        // Inquiries Table
        const inquiriesBody = document.getElementById('inquiries-table-body');
        inquiriesBody.innerHTML = inquiries.map(i => {
            const date = i.created_at ? new Date(i.created_at).toLocaleDateString() : (i.date || 'N/A');
            return `
                <tr>
                    <td>${date}</td>
                    <td>${i.name}</td>
                    <td>${i.email}</td>
                    <td>${i.message}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="deleteInquiry(${i.id})"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // --- Global Actions (API-powered) ---
    window.deleteBooking = async (id) => {
        if (confirm('Delete this booking?')) {
            try {
                await apiCall(`bookings?id=${id}`, 'DELETE');
                showToast('Booking deleted');
            } catch (e) {
                let bookings = JSON.parse(localStorage.getItem('bookings')) || [];
                bookings = bookings.filter(b => b.id !== id);
                localStorage.setItem('bookings', JSON.stringify(bookings));
                showToast('Booking deleted (offline)');
            }
            renderDashboard();
        }
    };

    window.deleteInquiry = async (id) => {
        try {
            await apiCall(`inquiries?id=${id}`, 'DELETE');
            showToast('Inquiry deleted');
        } catch (e) {
            let inquiries = JSON.parse(localStorage.getItem('inquiries')) || [];
            inquiries = inquiries.filter(i => i.id !== id);
            localStorage.setItem('inquiries', JSON.stringify(inquiries));
            showToast('Inquiry deleted (offline)');
        }
        renderDashboard();
    };

});
