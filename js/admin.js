// Admin Panel JS — with Chart.js, CSV export, status management, govt ID viewer

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

// --- Admin PIN (reads from env or falls back to default) ---
const ADMIN_PIN = '1234'; // In production, use Netlify env variable

let allBookings = [];
let allInquiries = [];

document.addEventListener('DOMContentLoaded', () => {
    // Login overlay
    const overlay = document.getElementById('admin-login-overlay');
    document.getElementById('admin-login-btn').addEventListener('click', () => {
        const pin = document.getElementById('admin-pin').value;
        if (pin === ADMIN_PIN) {
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
            document.getElementById('page-title').innerText =
                item.dataset.tab.charAt(0).toUpperCase() + item.dataset.tab.slice(1) + ' Overview';
        });
    });

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

    // Get total users
    let totalUsers = 0;
    try {
        const usersRes = await apiCall('users', 'POST', { action: 'count' });
        if (usersRes.success) totalUsers = usersRes.count;
    } catch (e) { }

    // Stats
    const totalRevenue = bookings.reduce((sum, b) => sum + (parseInt(b.price) || 0), 0);
    document.getElementById('total-bookings').innerText = bookings.length;
    document.getElementById('total-inquiries').innerText = inquiries.length;
    document.getElementById('total-revenue').innerText = `₹${totalRevenue.toLocaleString()}`;
    document.getElementById('total-users').innerText = totalUsers;

    // Render tables
    renderBookingsTable(bookings);
    renderInquiriesTable(inquiries);

    // Render revenue chart
    renderRevenueChart(bookings);
}

// --- Revenue Chart (Chart.js) ---
let revenueChartInstance = null;

function renderRevenueChart(bookings) {
    const roomTypes = {};
    bookings.forEach(b => {
        const room = b.room || 'Unknown';
        roomTypes[room] = (roomTypes[room] || 0) + (parseInt(b.price) || 0);
    });

    const labels = Object.keys(roomTypes);
    const data = Object.values(roomTypes);
    const colors = ['#D4AF37', '#800020', '#1A0505', '#27ae60', '#3498db'];

    const ctx = document.getElementById('revenue-chart').getContext('2d');
    if (revenueChartInstance) revenueChartInstance.destroy();

    revenueChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Revenue (₹)',
                data,
                backgroundColor: colors.slice(0, labels.length),
                borderRadius: 8,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `₹${ctx.raw.toLocaleString()}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: v => `₹${v.toLocaleString()}` }
                }
            }
        }
    });
}

// --- Bookings Table with Status Management & Govt ID ---
function renderBookingsTable(bookings) {
    const tbody = document.getElementById('bookings-table-body');
    tbody.innerHTML = '';
    bookings.forEach(b => {
        const statusClass = (b.status || '').toLowerCase().includes('cancel') ? 'cancelled' : '';
        const govtIdCell = b.govt_id_data
            ? `<a class="govtid-link" onclick="viewGovtId('${b.govt_id_data.replace(/'/g, "\\'")}')">📄 ${b.govt_id_name || 'View'}</a>`
            : '—';

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
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteInquiry(${i.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Status Update ---
window.updateBookingStatus = async function (id, status, selectEl) {
    try {
        await apiCall(`bookings`, 'PUT', { id, status });
        showToast(`Booking #${id} status updated to "${status}"`);
        selectEl.className = 'status-select' + (status === 'Cancelled' ? ' cancelled' : '');
    } catch (e) {
        showToast('Failed to update status', 'error');
    }
};

// --- Delete Booking ---
window.deleteBooking = async function (id) {
    if (!confirm('Delete this booking?')) return;
    try {
        await apiCall(`bookings?id=${id}`, 'DELETE');
        showToast('Booking deleted');
        renderDashboard();
    } catch (e) {
        const bookings = JSON.parse(localStorage.getItem('bookings')) || [];
        localStorage.setItem('bookings', JSON.stringify(bookings.filter(b => b.id !== id)));
        showToast('Booking deleted (offline)');
        renderDashboard();
    }
};

// --- Delete Inquiry ---
window.deleteInquiry = async function (id) {
    if (!confirm('Delete this inquiry?')) return;
    try {
        await apiCall(`inquiries?id=${id}`, 'DELETE');
        showToast('Inquiry deleted');
        renderDashboard();
    } catch (e) {
        const inquiries = JSON.parse(localStorage.getItem('inquiries')) || [];
        localStorage.setItem('inquiries', JSON.stringify(inquiries.filter(i => i.id !== id)));
        showToast('Inquiry deleted (offline)');
        renderDashboard();
    }
};

// --- View Govt ID ---
window.viewGovtId = function (base64Data) {
    const modal = document.getElementById('govtid-modal');
    const img = document.getElementById('govtid-image');
    img.src = base64Data;
    modal.style.display = 'block';
};

// --- Export Bookings CSV ---
window.exportBookingsCSV = function () {
    if (allBookings.length === 0) { showToast('No bookings to export', 'error'); return; }
    const headers = ['ID', 'Name', 'Email', 'DOB', 'Room', 'Check-In', 'Check-Out', 'Price', 'Status'];
    const rows = allBookings.map(b => [
        b.id, b.name, b.email || '', b.dob || '', b.room, b.checkin, b.checkout, b.price, b.status
    ]);
    downloadCSV(headers, rows, 'bookings_export.csv');
    showToast('Bookings exported!');
};

// --- Export Inquiries CSV ---
window.exportInquiriesCSV = function () {
    if (allInquiries.length === 0) { showToast('No inquiries to export', 'error'); return; }
    const headers = ['ID', 'Name', 'Email', 'Message', 'Date'];
    const rows = allInquiries.map(i => [
        i.id, i.name, i.email, `"${(i.message || '').replace(/"/g, '""')}"`,
        i.created_at ? new Date(i.created_at).toLocaleDateString() : ''
    ]);
    downloadCSV(headers, rows, 'inquiries_export.csv');
    showToast('Inquiries exported!');
};

// --- CSV Download Helper ---
function downloadCSV(headers, rows, filename) {
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
