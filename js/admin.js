document.addEventListener('DOMContentLoaded', () => {

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

    // --- Toast Logic (Shared) ---
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

    // --- Render Logic ---
    function renderDashboard() {
        const bookings = JSON.parse(localStorage.getItem('bookings')) || [];
        const inquiries = JSON.parse(localStorage.getItem('inquiries')) || [];

        // Stats
        document.getElementById('total-bookings').innerText = bookings.length;
        document.getElementById('total-inquiries').innerText = inquiries.length;

        // Revenue Estimate (Mock calculation based on room type)
        let revenue = 0;
        bookings.forEach(b => {
            if (b.room.includes('Deluxe')) revenue += 2500;
            else if (b.room.includes('Executive')) revenue += 4500;
            else if (b.room.includes('Presidential')) revenue += 8000;
        });
        document.getElementById('total-revenue').innerText = `₹${revenue.toLocaleString()}`;

        // Bookings Table
        const bookingsBody = document.getElementById('bookings-table-body');
        bookingsBody.innerHTML = bookings.map(b => `
            <tr>
                <td>#${b.id.toString().slice(-4)}</td>
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
        inquiriesBody.innerHTML = inquiries.map(i => `
            <tr>
                <td>${i.date}</td>
                <td>${i.name}</td>
                <td>${i.email}</td>
                <td>${i.message}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteInquiry(${i.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    // --- Global Actions ---
    window.deleteBooking = (id) => {
        if (confirm('Delete this booking?')) {
            let bookings = JSON.parse(localStorage.getItem('bookings')) || [];
            bookings = bookings.filter(b => b.id !== id);
            localStorage.setItem('bookings', JSON.stringify(bookings));
            renderDashboard();
            showToast('Booking deleted');
        }
    };

    window.deleteInquiry = (id) => {
        let inquiries = JSON.parse(localStorage.getItem('inquiries')) || [];
        inquiries = inquiries.filter(i => i.id !== id);
        localStorage.setItem('inquiries', JSON.stringify(inquiries));
        renderDashboard();
        showToast('Inquiry deleted');
    };

});
