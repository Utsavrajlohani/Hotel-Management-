// Admin Panel JS — Chart.js, CSV export, status mgmt, room CRUD, blacklist, coupons, date filter

const API_BASE = '/.netlify/functions';

async function apiCall(endpoint, method = 'GET', body = null) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}/${endpoint}`, options);
    return res.json();
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 500); }, 3000);
}

const ADMIN_PIN = '1234';
let allBookings = [];
let allInquiries = [];

document.addEventListener('DOMContentLoaded', () => {
    // Login
    const overlay = document.getElementById('admin-login-overlay');
    document.getElementById('admin-login-btn').addEventListener('click', () => {
        if (document.getElementById('admin-pin').value === ADMIN_PIN) {
            overlay.style.display = 'none';
            renderDashboard();
        } else {
            alert('Invalid PIN!');
        }
    });
    document.getElementById('admin-pin').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') document.getElementById('admin-login-btn').click();
    });

    // Tab switching
    document.querySelectorAll('.sidebar .menu li[data-tab]').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.menu li').forEach(li => li.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            document.getElementById(item.dataset.tab).classList.add('active');
            const titles = {
                'dashboard': 'Dashboard Overview',
                'bookings': 'Bookings Management',
                'inquiries': 'Inquiries',
                'rooms-mgmt': 'Room Inventory',
                'blacklist': 'Guest Blacklist',
                'coupons-mgmt': 'Promo Coupons'
            };
            document.getElementById('page-title').innerText = titles[item.dataset.tab] || 'Admin';

            if (item.dataset.tab === 'rooms-mgmt') renderRoomsTable();
            if (item.dataset.tab === 'blacklist') renderBlacklistTable();
            if (item.dataset.tab === 'coupons-mgmt') renderCouponsTable();
        });
    });

    // Date range filter
    document.getElementById('date-range-filter').addEventListener('change', () => renderDashboard());

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        window.location.href = 'index.html';
    });
});

// --- Render Dashboard ---
async function renderDashboard() {
    let bookings = [];
    try {
        const bookingsRes = await apiCall('bookings');
        if (bookingsRes.success) bookings = bookingsRes.bookings;
    } catch (e) {
        bookings = JSON.parse(localStorage.getItem('bookings')) || [];
    }
    allBookings = bookings;

    let inquiries = [];
    try {
        const inquiriesRes = await apiCall('inquiries');
        if (inquiriesRes.success) inquiries = inquiriesRes.inquiries;
    } catch (e) {
        inquiries = JSON.parse(localStorage.getItem('inquiries')) || [];
    }
    allInquiries = inquiries;

    let totalUsers = 0;
    try {
        const usersRes = await apiCall('users', 'POST', { action: 'count' });
        if (usersRes.success) totalUsers = usersRes.count;
    } catch (e) { }

    // Date Range Filter
    const filter = document.getElementById('date-range-filter').value;
    let filteredBookings = bookings;
    if (filter !== 'all') {
        const now = new Date();
        filteredBookings = bookings.filter(b => {
            const d = new Date(b.created_at || b.checkin);
            if (filter === 'today') return d.toDateString() === now.toDateString();
            if (filter === 'week') {
                const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
                return d >= weekAgo;
            }
            if (filter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            return true;
        });
    }

    const totalRevenue = filteredBookings.reduce((sum, b) => sum + (parseInt(b.price) || 0), 0);
    document.getElementById('total-bookings').innerText = filteredBookings.length;
    document.getElementById('total-inquiries').innerText = inquiries.length;
    document.getElementById('total-revenue').innerText = `₹${totalRevenue.toLocaleString()}`;
    document.getElementById('total-users').innerText = totalUsers;

    renderBookingsTable(filteredBookings);
    renderInquiriesTable(inquiries);
    renderRevenueChart(filteredBookings);
}

// --- Revenue Chart ---
let revenueChartInstance = null;

function renderRevenueChart(bookings) {
    const roomTypes = {};
    bookings.forEach(b => {
        const room = b.room || 'Unknown';
        roomTypes[room] = (roomTypes[room] || 0) + (parseInt(b.price) || 0);
    });
    const labels = Object.keys(roomTypes);
    const data = Object.values(roomTypes);
    const colors = ['#D4AF37', '#800020', '#1A0505', '#27ae60', '#3498db', '#e74c3c'];

    const ctx = document.getElementById('revenue-chart').getContext('2d');
    if (revenueChartInstance) revenueChartInstance.destroy();

    revenueChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{ label: 'Revenue (₹)', data, backgroundColor: colors.slice(0, labels.length), borderRadius: 8, borderWidth: 0 }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `₹${ctx.raw.toLocaleString()}` } } },
            scales: { y: { beginAtZero: true, ticks: { callback: v => `₹${v.toLocaleString()}` } } }
        }
    });
}

// --- Bookings Table ---
function renderBookingsTable(bookings) {
    const tbody = document.getElementById('bookings-table-body');
    tbody.innerHTML = '';
    bookings.forEach(b => {
        const statusClass = (b.status || '').toLowerCase().includes('cancel') ? 'cancelled' : '';
        const govtIdCell = b.govt_id || '—';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${b.id}</td>
            <td><strong>${b.name}</strong><br><small>${b.email || ''}</small></td>
            <td>${b.room}</td>
            <td>${b.dob || '—'}</td>
            <td>${govtIdCell}</td>
            <td>${b.checkin}</td>
            <td>${b.checkout}</td>
            <td>₹${parseInt(b.price).toLocaleString()}</td>
            <td>
                <select class="status-select ${statusClass}" onchange="updateBookingStatus(${b.id}, this.value, this)">
                    <option value="Confirmed" ${b.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                    <option value="Checked In" ${b.status === 'Checked In' ? 'selected' : ''}>Checked In</option>
                    <option value="Checked Out" ${b.status === 'Checked Out' ? 'selected' : ''}>Checked Out</option>
                    <option value="Cancelled" ${b.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteBooking(${b.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Inquiries Table ---
function renderInquiriesTable(inquiries) {
    const tbody = document.getElementById('inquiries-table-body');
    tbody.innerHTML = '';
    inquiries.forEach(i => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${i.created_at ? new Date(i.created_at).toLocaleDateString() : '—'}</td>
            <td>${i.name}</td>
            <td>${i.email}</td>
            <td>${i.message}</td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteInquiry(${i.id})"><i class="fas fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Status Update ---
window.updateBookingStatus = async function (id, status, selectEl) {
    try {
        await apiCall('bookings', 'PUT', { id, status });
        showToast(`Booking #${id} → "${status}"`);
        selectEl.className = 'status-select' + (status === 'Cancelled' ? ' cancelled' : '');
    } catch (e) { showToast('Failed to update', 'error'); }
};

// --- Delete Booking ---
window.deleteBooking = async function (id) {
    if (!confirm('Delete this booking?')) return;
    try { await apiCall(`bookings?id=${id}`, 'DELETE'); } catch (e) { }
    showToast('Booking deleted');
    renderDashboard();
};

// --- Delete Inquiry ---
window.deleteInquiry = async function (id) {
    if (!confirm('Delete this inquiry?')) return;
    try { await apiCall(`inquiries?id=${id}`, 'DELETE'); } catch (e) { }
    showToast('Inquiry deleted');
    renderDashboard();
};

// --- Export Bookings CSV ---
window.exportBookingsCSV = function () {
    if (allBookings.length === 0) { showToast('No data', 'error'); return; }
    const headers = ['ID', 'Name', 'Email', 'DOB', 'GovtID', 'Room', 'Check-In', 'Check-Out', 'Price', 'Status'];
    const rows = allBookings.map(b => [b.id, b.name, b.email || '', b.dob || '', b.govt_id || '', b.room, b.checkin, b.checkout, b.price, b.status]);
    downloadCSV(headers, rows, 'bookings_export.csv');
    showToast('Bookings exported!');
};

// --- Export Inquiries CSV ---
window.exportInquiriesCSV = function () {
    if (allInquiries.length === 0) { showToast('No data', 'error'); return; }
    const headers = ['ID', 'Name', 'Email', 'Message', 'Date'];
    const rows = allInquiries.map(i => [i.id, i.name, i.email, `"${(i.message || '').replace(/"/g, '""')}"`, i.created_at ? new Date(i.created_at).toLocaleDateString() : '']);
    downloadCSV(headers, rows, 'inquiries_export.csv');
    showToast('Inquiries exported!');
};

function downloadCSV(headers, rows, filename) {
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

// ============= ROOM MANAGEMENT =============

async function renderRoomsTable() {
    let rooms = [];
    try {
        const res = await apiCall('rooms');
        if (res.success) rooms = res.rooms;
    } catch (e) { }

    const tbody = document.getElementById('rooms-table-body');
    tbody.innerHTML = '';
    rooms.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.id}</td>
            <td><img src="${r.image}" alt="${r.name}" style="width:80px;height:50px;object-fit:cover;border-radius:4px;"></td>
            <td><strong>${r.name}</strong></td>
            <td>₹${parseInt(r.price).toLocaleString()}</td>
            <td>${(r.amenities || []).join(', ')}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="editRoom(${r.id}, '${r.name}', ${r.price}, '${(r.amenities || []).join(',')}', '${r.image}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteRoom(${r.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.showAddRoomForm = function () {
    document.getElementById('room-form-area').style.display = 'block';
    document.getElementById('room-form-title').textContent = 'Add New Room';
    document.getElementById('rm-name').value = '';
    document.getElementById('rm-price').value = '';
    document.getElementById('rm-amenities').value = '';
    document.getElementById('rm-image').value = '';
    document.getElementById('rm-edit-id').value = '';
};

window.editRoom = function (id, name, price, amenities, image) {
    document.getElementById('room-form-area').style.display = 'block';
    document.getElementById('room-form-title').textContent = 'Edit Room';
    document.getElementById('rm-name').value = name;
    document.getElementById('rm-price').value = price;
    document.getElementById('rm-amenities').value = amenities;
    document.getElementById('rm-image').value = image;
    document.getElementById('rm-edit-id').value = id;
};

window.saveRoom = async function () {
    const name = document.getElementById('rm-name').value.trim();
    const price = parseInt(document.getElementById('rm-price').value);
    const amenities = document.getElementById('rm-amenities').value.split(',').map(a => a.trim()).filter(a => a);
    const image = document.getElementById('rm-image').value.trim();
    const editId = document.getElementById('rm-edit-id').value;

    if (!name || !price) { showToast('Name and Price are required', 'error'); return; }

    try {
        if (editId) {
            await apiCall('rooms', 'PUT', { id: parseInt(editId), name, price, price_display: price.toLocaleString(), image, amenities });
            showToast('Room updated!');
        } else {
            await apiCall('rooms', 'POST', { name, price, price_display: price.toLocaleString(), image, amenities });
            showToast('Room added!');
        }
    } catch (e) { showToast('Failed to save room', 'error'); }

    document.getElementById('room-form-area').style.display = 'none';
    renderRoomsTable();
};

window.deleteRoom = async function (id) {
    if (!confirm('Delete this room?')) return;
    try { await apiCall(`rooms?id=${id}`, 'DELETE'); } catch (e) { }
    showToast('Room deleted');
    renderRoomsTable();
};

// ============= BLACKLIST =============

function renderBlacklistTable() {
    const blacklist = JSON.parse(localStorage.getItem('blacklist')) || [];
    const tbody = document.getElementById('blacklist-table-body');
    tbody.innerHTML = '';
    blacklist.forEach((b, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${b.phone}</td>
            <td>${b.reason}</td>
            <td>${b.date}</td>
            <td><button class="btn btn-danger btn-sm" onclick="removeFromBlacklist(${i})"><i class="fas fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
}

window.addToBlacklist = function () {
    const phone = document.getElementById('bl-phone').value.trim();
    const reason = document.getElementById('bl-reason').value.trim();
    if (!phone) { showToast('Phone number required', 'error'); return; }
    const blacklist = JSON.parse(localStorage.getItem('blacklist')) || [];
    blacklist.push({ phone, reason, date: new Date().toLocaleDateString() });
    localStorage.setItem('blacklist', JSON.stringify(blacklist));
    showToast(`${phone} blacklisted`);
    document.getElementById('bl-phone').value = '';
    document.getElementById('bl-reason').value = '';
    renderBlacklistTable();
};

window.removeFromBlacklist = function (index) {
    const blacklist = JSON.parse(localStorage.getItem('blacklist')) || [];
    blacklist.splice(index, 1);
    localStorage.setItem('blacklist', JSON.stringify(blacklist));
    showToast('Removed from blacklist');
    renderBlacklistTable();
};

// ============= COUPONS MANAGEMENT =============

function renderCouponsTable() {
    const coupons = JSON.parse(localStorage.getItem('adminCoupons')) || [
        { code: 'WELCOME10', discount: 10, type: 'percent' },
        { code: 'FLAT500', discount: 500, type: 'flat' },
        { code: 'LUXURY20', discount: 20, type: 'percent' },
        { code: 'GRAND15', discount: 15, type: 'percent' }
    ];
    const tbody = document.getElementById('coupons-table-body');
    tbody.innerHTML = '';
    coupons.forEach((c, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${c.code}</strong></td>
            <td>${c.discount}</td>
            <td>${c.type === 'percent' ? '% Off' : '₹ Flat'}</td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteCoupon(${i})"><i class="fas fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
}

window.addCoupon = function () {
    const code = document.getElementById('cp-code').value.trim().toUpperCase();
    const discount = parseInt(document.getElementById('cp-discount').value);
    const type = document.getElementById('cp-type').value;
    if (!code || !discount) { showToast('Code and discount required', 'error'); return; }
    const coupons = JSON.parse(localStorage.getItem('adminCoupons')) || [
        { code: 'WELCOME10', discount: 10, type: 'percent' },
        { code: 'FLAT500', discount: 500, type: 'flat' },
        { code: 'LUXURY20', discount: 20, type: 'percent' },
        { code: 'GRAND15', discount: 15, type: 'percent' }
    ];
    coupons.push({ code, discount, type });
    localStorage.setItem('adminCoupons', JSON.stringify(coupons));
    showToast(`Coupon "${code}" added!`);
    document.getElementById('cp-code').value = '';
    document.getElementById('cp-discount').value = '';
    renderCouponsTable();
};

window.deleteCoupon = function (index) {
    const coupons = JSON.parse(localStorage.getItem('adminCoupons')) || [];
    coupons.splice(index, 1);
    localStorage.setItem('adminCoupons', JSON.stringify(coupons));
    showToast('Coupon deleted');
    renderCouponsTable();
};
