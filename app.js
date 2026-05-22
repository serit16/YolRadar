const ADMIN_NUMBERS = [
    "5468593917"
];

let allowedPhoneNumbers = [...ADMIN_NUMBERS];

const typeConfig = {
    radar: { icon: '📸', label: 'Radar',           color: '#FF9F0A' },
    kaza:  { icon: '💥', label: 'Kaza',            color: '#FF453A' },
    polis: { icon: '🚓', label: 'Polis Çevirmesi', color: '#0A84FF' }
};

const ONE_HOUR          = 60 * 60 * 1000;
const ANTI_SPAM_RADIUS  = 200;           
const ANTI_SPAM_TIME    = 3 * 60 * 1000; 
const VOICE_DIST        = 2000;          


const firebaseConfig = {
    apiKey: "AIzaSyCn-5PRNzGZudANz_A3Phol4t6CL7AZNMo",
    authDomain: "serit-18987.firebaseapp.com",
    databaseURL: "https://serit-18987-default-rtdb.firebaseio.com",
    projectId: "serit-18987",
    storageBucket: "serit-18987.firebasestorage.app",
    messagingSenderId: "515327594730",
    appId: "1:515327594730:web:40f896d1ce36ad6a0ec793"
};


let database = null;

try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
} catch(e) { console.warn('Firebase init failed'); }


if (typeof L === 'undefined') {
    document.body.innerHTML = '<div style="color:red;padding:20px;font-size:18px;">❌ Leaflet yüklenemedi. İnternet bağlantınızı kontrol edin ve sayfayı yenileyin.</div>';
    throw new Error('Leaflet not loaded');
}

const map = L.map('map', {
    zoomControl: false,
    preferCanvas: true
}).setView([39.9334, 32.8597], 7);

window.map = map;

const osmTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
});

const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd'
});

const cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd'
});

const tileLayers = {
    dark: cartoDark,
    light: cartoLight,
    osm: osmTile
};

let currentTileLayer = null;
let tileErrorCount = 0;

function setMapTiles(theme) {
    if (currentTileLayer) {
        map.removeLayer(currentTileLayer);
    }
    tileErrorCount = 0;
    currentTileLayer = tileLayers[theme] || osmTile;

    currentTileLayer.off('tileerror');
    currentTileLayer.on('tileerror', function() {
        tileErrorCount++;
        if (tileErrorCount >= 3 && currentTileLayer !== osmTile) {
            map.removeLayer(currentTileLayer);
            currentTileLayer = osmTile;
            currentTileLayer.addTo(map);
        }
    });

    currentTileLayer.addTo(map);
}

currentTileLayer = osmTile;
osmTile.addTo(map);

L.control.zoom({ position: 'topright' }).addTo(map);

const markerCluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 60,
    iconCreateFunction(cluster) {
        const cnt = cluster.getChildCount();
        const size = cnt > 20 ? 'lg' : cnt > 5 ? 'md' : 'sm';
        return L.divIcon({
            html: `<div class="cluster-icon cluster-${size}">${cnt}</div>`,
            className: '',
            iconSize: [44, 44]
        });
    }
});
map.addLayer(markerCluster);


function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    setMapTiles(theme);
    localStorage.setItem('theme', theme);

    setTimeout(function() {
        var tilePane = document.querySelector('.leaflet-tile-pane');
        if (tilePane) {
            if (theme === 'dark') {
                tilePane.style.filter = 'brightness(1.8) saturate(1.4) hue-rotate(-15deg) contrast(0.85)';
            } else {
                tilePane.style.filter = 'none';
            }
        }
    }, 100);

    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}
const savedTheme = localStorage.getItem('theme');
if (savedTheme && savedTheme !== 'osm') {
    applyTheme(savedTheme);
} else {
    applyTheme('light');
}


let userLocation  = null;
let userMarker    = null;
let alertedMarkers = new Set();
let activeMarkers  = {};       
let allReportsData = {};       
let tempLatLng     = null;
let routingControl = null;
let chartTrend     = null;
let chartType      = null;
let drivingMode    = false;    
let dangerCircles  = [];      
let reportCircles  = {};      
let initialLocationSet = false;
let voiceEnabled = localStorage.getItem('voiceEnabled') !== 'false';
let isPremiumUser = false; // Premium üyelik durumu
if ('speechSynthesis' in window) { window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.getVoices(); }; } 

// GPS izleme sadece aşağıda (KONUM TAKİBİ bölümünde) başlatılıyor


(function setupAuth() {
    handleUrlParams();

    var role = localStorage.getItem('userRole');
    var loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (loggedIn && role === 'admin') {
        var ap = document.getElementById('admin-panel');
        if (ap && ap.style.display === 'none') {
            ap.style.display = 'flex';
            initAdminPanel();
        }
    }
})();


document.addEventListener('DOMContentLoaded', () => {

    document.getElementById('btn-admin-logout').addEventListener('click', () => {
        localStorage.clear(); location.reload();
    });
    document.getElementById('btn-user-logout')?.addEventListener('click', () => {
        localStorage.clear(); location.reload();
    });

    document.getElementById('btn-back-admin')?.addEventListener('click', () => {
        document.getElementById('btn-back-admin').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'flex';
    });

    // ---- Tema toggle ----
    document.getElementById('btn-theme').addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'dark';
        applyTheme(cur === 'dark' ? 'light' : 'dark');
    });

    // ---- Konuma git (tek seferlik) ----
    document.getElementById('btn-locate').addEventListener('click', () => {
        if (userLocation) {
            map.setView(userLocation, 16, { animate: true });
        } else {
            // watch zaten aktif, kullanıcıya bilgi ver
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
                        userLocation = ll;
                        map.setView(ll, 16, { animate: true });
                    },
                    () => { alert('Konum alınamadı. Lütfen konum iznini kontrol edin.'); },
                    { enableHighAccuracy: true, timeout: 8000 }
                );
            }
        }
    });


    // ---- Ses aç/kapa ----
    const btnVoice = document.getElementById('btn-voice');
    if (btnVoice) {
        // Başlangıç durumunu ayarla
        btnVoice.classList.toggle('active-btn', voiceEnabled);
        btnVoice.style.opacity = voiceEnabled ? '1' : '0.5';
        btnVoice.addEventListener('click', () => {
            voiceEnabled = !voiceEnabled;
            localStorage.setItem('voiceEnabled', voiceEnabled);
            btnVoice.classList.toggle('active-btn', voiceEnabled);
            btnVoice.style.opacity = voiceEnabled ? '1' : '0.5';
            if (!voiceEnabled) window.speechSynthesis?.cancel();
        });
    }

    document.getElementById('btn-route-clear').addEventListener('click', () => {
        clearRoute();
    });


    // ---- Sürüş modu butonları ----
    document.getElementById('btn-start-driving')?.addEventListener('click', startDrivingMode);
    document.getElementById('btn-stop-driving')?.addEventListener('click', stopDrivingMode);
    
    document.getElementById('btn-quick-report-float')?.addEventListener('click', () => {
        document.getElementById('quick-report-modal').style.display = 'flex';
    });

}); // END DOMContentLoaded


function initAdminPanel() {
    if (!database) return;

    // Sekme sistemi
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => {
                c.classList.remove('active');
                c.style.display = 'none';
            });
            btn.classList.add('active');
            const target = document.getElementById(btn.dataset.tab);
            if (target) { target.style.display = 'block'; target.classList.add('active'); }
            if (btn.dataset.tab === 'tab-charts') initCharts();
            if (btn.dataset.tab === 'tab-leaderboard') renderLeaderboard();
            if (btn.dataset.tab === 'tab-users') renderUsersTab();
            if (btn.dataset.tab === 'tab-hotspots') renderHotspotsTab();
        });
    });


    database.ref('reports').on('value', snap => {
        allReportsData = snap.val() || {};
        renderReportsTable(allReportsData);
        updateStatCards(allReportsData);
    });

    const saveBtn = document.getElementById('btn-save-numbers');
    if (saveBtn && !saveBtn._b) {
        saveBtn._b = true;
        saveBtn.addEventListener('click', () => {
            const raw = document.getElementById('bulk-numbers-input').value;
            const nums = raw.split(/[,\n\r]+/)
                .map(n => n.replace(/\D/g, '').slice(-10))
                .filter(n => n.length === 10);
            if (!nums.length) { alert('Geçerli numara bulunamadı.'); return; }
            database.ref('whitelist').once('value').then(snap => {
                const existingWhitelist = snap.val() || {};
                const existingNums = Object.values(existingWhitelist);
                
                // Sadece yeni olanları filtrele
                const newNums = nums.filter(n => !existingNums.includes(n));
                
                if (newNums.length === 0) {
                    alert('Girdiğiniz numaralar zaten sistemde kayıtlı.');
                    return;
                }
                
                // Mevcut obje uzunluğundan devam et veya rastgele key üret
                const updateObj = {};
                newNums.forEach(n => {
                    // Unique ID oluşturarak ekle (üzerine yazmayı kesinlikle önler)
                    const newKey = database.ref().child('whitelist').push().key;
                    updateObj[newKey] = n;
                });
                
                database.ref('whitelist').update(updateObj).then(() => {
                    allowedPhoneNumbers = [...existingNums, ...newNums];
                    document.getElementById('bulk-numbers-input').value = '';
                    alert(`✅ ${newNums.length} yeni numara sisteme eklendi!`);
                }).catch(e => alert('Hata: ' + e.message));
            }).catch(e => alert('Hata: ' + e.message));
        });
    }

    // CSV export
    document.getElementById('btn-export-csv')?.addEventListener('click', exportCsv);
}

// İhbar tablosunu render et
function renderReportsTable(data) {
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const keys = Object.keys(data).reverse();
    keys.forEach(key => {
        const r = data[key];
        const by = r.addedBy || 'Bilinmiyor';
        const ti = typeConfig[r.type] || { icon: '❓', label: r.type };
        const d = new Date(r.createdAt);
        const dateStr = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
            + ' · ' + d.toLocaleDateString('tr-TR');
        const noteStr = r.note ? `<span title="${r.note}">📝 ${r.note.substring(0, 20)}${r.note.length > 20 ? '…' : ''}</span>` : '—';

        const confKeys = r.confirmations ? Object.keys(r.confirmations) : [];
        const confirmersStr = confKeys.length > 0 ? confKeys.join('<br>') : '<span style="color:#aaa;">Yok</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${ti.icon} ${ti.label}</td>
            <td style="font-family:monospace;">${by}</td>
            <td style="font-size:12px;color:var(--text-muted);">${noteStr}</td>
            <td style="font-size:12px;">${dateStr}</td>
            <td style="font-size:12px;font-family:monospace;">
                <span class="coord-link" data-lat="${r.lat}" data-lng="${r.lng}"
                      style="color:var(--accent-blue);cursor:pointer;text-decoration:underline;">
                    ${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}
                </span>
            </td>
            <td style="color:var(--accent-red);font-weight:700;">${r.downvotes || 0}</td>
            <td style="color:var(--accent-orange);font-weight:700;">${r.flags || 0}</td>
            <td style="font-family:monospace;font-size:11px;line-height:1.2;">${confirmersStr}</td>
            <td>
                <button class="admin-btn btn-danger"  onclick="adminDeleteReport('${key}')">🗑️ Sil</button>
                <button class="admin-btn btn-warning" onclick="adminBanUser('${by}','${key}')">🚫 Banla</button>
            </td>`;
        tbody.appendChild(tr);
    });

    // Koordinat → haritaya uç
    tbody.querySelectorAll('.coord-link').forEach(el => {
        el.addEventListener('click', () => {
            const lat = parseFloat(el.dataset.lat), lng = parseFloat(el.dataset.lng);
            document.getElementById('admin-panel').style.display = 'none';
            document.getElementById('btn-back-admin').style.display = 'block';
            map.setView([lat, lng], 17, { animate: true });
            const m = L.marker([lat, lng]).addTo(map).bindPopup('📍 Admin seçimi').openPopup();
            setTimeout(() => map.removeLayer(m), 8000);
        });
    });
}

// Stat kartlarını güncelle
function updateStatCards(data) {
    const keys = Object.keys(data);
    document.getElementById('stat-total-reports').textContent = keys.length;

    const users = new Set(keys.map(k => data[k].addedBy).filter(Boolean));
    document.getElementById('stat-active-users').textContent = users.size;

    const flagged = keys.filter(k => (data[k].flags || 0) >= 3).length;
    document.getElementById('stat-flagged').textContent = flagged;

    if (!database) return;
    database.ref('banned').once('value').then(snap => {
        const cnt = Object.keys(snap.val() || {}).length;
        document.getElementById('stat-banned-users').textContent = cnt;
    });
}

// Şikayetler Tablosunu Render Et
function renderComplaintsTable(data) {
    const tbody = document.getElementById('complaints-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Tüm şikayetleri düzleştirip diziye al (tarihe göre sıralamak için)
    let complaintsList = [];
    Object.keys(data).forEach(key => {
        const r = data[key];
        if (r.flaggers) {
            Object.keys(r.flaggers).forEach(flaggerPhone => {
                complaintsList.push({
                    reportKey: key,
                    flagger: flaggerPhone,
                    reportedUser: r.addedBy || 'Bilinmiyor',
                    type: r.type,
                    note: r.note,
                    timestamp: r.flaggers[flaggerPhone]
                });
            });
        }
    });

    // En yeni şikayetler üstte
    complaintsList.sort((a, b) => b.timestamp - a.timestamp);

    complaintsList.forEach(c => {
        const ti = typeConfig[c.type] || { icon: '❓', label: c.type };
        const d = new Date(c.timestamp);
        const dateStr = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString('tr-TR');
        const noteStr = c.note ? `<span title="${c.note}">📝 ${c.note.substring(0, 15)}${c.note.length > 15 ? '…' : ''}</span>` : '—';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-family:monospace; color:var(--accent-orange); font-weight:700;">${c.flagger}</td>
            <td style="font-family:monospace;">${c.reportedUser}</td>
            <td>${ti.icon} ${ti.label} <br><small style="color:var(--text-muted);">${noteStr}</small></td>
            <td style="font-size:12px;">${dateStr}</td>
            <td>
                <button class="admin-btn btn-danger" onclick="adminDeleteReport('${c.reportKey}')">🗑️ İhbarı Sil</button>
                <button class="admin-btn btn-warning" onclick="adminBanUser('${c.reportedUser}','${c.reportKey}')">🚫 Ekleyeni Banla</button>
            </td>`;
        tbody.appendChild(tr);
    });
}

// Kullanıcılar sekmesi
let _cachedUserMap = {};
let _cachedBanned  = [];

function renderUsersTab() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="13" style="text-align:center;color:var(--text-muted);padding:20px;">Yükleniyor…</td></tr>';

    if (!database) return;

    Promise.all([
        database.ref('whitelist').once('value'),
        database.ref('banned').once('value'),
        database.ref('users').once('value')
    ]).then(([whiteSnap, bannedSnap, usersSnap]) => {
        const whitelist = Object.values(whiteSnap.val() || {});
        const banned    = Object.values(bannedSnap.val() || {});
        const usersData = usersSnap.val() || {};

        const userMap = {};

        // 1) Whitelist'teki numaraları taban al
        whitelist.forEach(phone => {
            const p = phone.replace(/\D/g, '').slice(-10);
            if (p.length === 10 && !userMap[p]) {
                userMap[p] = { radar: 0, kaza: 0, polis: 0, score: 0, receivedFlags: 0 };
            }
        });

        // 2) Firebase users node'undan profil + giriş bilgileri
        Object.keys(usersData).forEach(p => {
            if (!userMap[p]) userMap[p] = { radar: 0, kaza: 0, polis: 0, score: 0, receivedFlags: 0 };
            const ud = usersData[p];
            userMap[p].score      = ud.score      || 0;
            userMap[p].firstLogin = ud.firstLogin || null;
            userMap[p].lastLogin  = ud.lastLogin  || null;
            userMap[p].loginCount = ud.loginCount || 0;
            userMap[p].premium    = ud.premium    || false;
            // Profil bilgileri
            userMap[p].name    = ud.name    || '';
            userMap[p].surname = ud.surname || '';
            userMap[p].city    = ud.city    || '';
            userMap[p].bio     = ud.bio     || '';
        });

        // 3) İhbar verileri — tipine göre ayrı say
        if (allReportsData) {
            Object.values(allReportsData).forEach(r => {
                const p = r.addedBy || 'Bilinmiyor';
                if (!userMap[p]) userMap[p] = { radar: 0, kaza: 0, polis: 0, score: 0, receivedFlags: 0 };
                if (r.type === 'radar') userMap[p].radar++;
                else if (r.type === 'kaza') userMap[p].kaza++;
                else if (r.type === 'polis') userMap[p].polis++;
                if (r.flaggers) {
                    userMap[p].receivedFlags = (userMap[p].receivedFlags || 0) + Object.keys(r.flaggers).length;
                } else {
                    userMap[p].receivedFlags = (userMap[p].receivedFlags || 0) + (r.flags || 0);
                }
            });
        }

        _cachedUserMap = userMap;
        _cachedBanned  = banned;
        renderUsersTableRows(userMap, banned);
    });
}

function renderUsersTableRows(userMap, banned, filterQ = '') {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    function fmtDate(ts) {
        if (!ts) return '<span style="color:var(--text-muted)">—</span>';
        const d = new Date(ts);
        return d.toLocaleDateString('tr-TR') + '<br><small style="color:var(--text-muted)">' +
               d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) + '</small>';
    }

    // Toplam ihbar sayısına göre sırala
    let sorted = Object.entries(userMap).sort((a, b) => {
        const totA = (a[1].radar || 0) + (a[1].kaza || 0) + (a[1].polis || 0);
        const totB = (b[1].radar || 0) + (b[1].kaza || 0) + (b[1].polis || 0);
        return totB - totA;
    });

    // Filtrele (numara veya isim)
    const q = filterQ.trim().toLowerCase();
    if (q) {
        sorted = sorted.filter(([phone, u]) => {
            const fullName = ((u.name || '') + ' ' + (u.surname || '')).toLowerCase();
            return phone.includes(q) || fullName.includes(q) || (u.city || '').toLowerCase().includes(q);
        });
    }

    // Sonuç sayısını göster
    const countEl = document.getElementById('user-search-count');
    if (countEl) {
        countEl.textContent = q ? `${sorted.length} sonuç` : `${sorted.length} kullanıcı`;
    }

    sorted.forEach(([phone, u]) => {
        const isBanned = banned.includes(phone);
        const isPrem = u.premium === true;
        const total = (u.radar || 0) + (u.kaza || 0) + (u.polis || 0);
        const fullName = [u.name, u.surname].filter(Boolean).join(' ') || '<span style="color:var(--text-muted);font-style:italic;">—</span>';
        const city = u.city || '<span style="color:var(--text-muted)">—</span>';

        const tr = document.createElement('tr');
        // Arama terimi varsa eşleşen satırı vurgula
        if (q && phone.includes(q)) tr.style.background = 'rgba(79,140,255,0.07)';

        tr.innerHTML = `
            <td style="font-family:monospace;font-weight:600;">${phone}${isPrem ? ' <span class="premium-badge-mini">👑</span>' : ''}</td>
            <td style="font-weight:600;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(u.name||'')+' '+(u.surname||'')}">${fullName}</td>
            <td style="font-size:13px;color:var(--text-muted);">${city}</td>
            <td style="text-align:center;font-weight:700;">${total}</td>
            <td style="text-align:center;">${u.radar  ? `<span style="color:#FF9F0A;">📸 ${u.radar}</span>` : '<span style="opacity:0.3">—</span>'}</td>
            <td style="text-align:center;">${u.kaza   ? `<span style="color:#FF453A;">💥 ${u.kaza}</span>`  : '<span style="opacity:0.3">—</span>'}</td>
            <td style="text-align:center;">${u.polis  ? `<span style="color:#0A84FF;">🚓 ${u.polis}</span>` : '<span style="opacity:0.3">—</span>'}</td>
            <td style="color:var(--accent-orange);font-weight:700;text-align:center;">${u.receivedFlags || 0}</td>
            <td style="color:var(--accent-blue);font-weight:700;text-align:center;">${u.score || 0}</td>
            <td style="font-size:12px;">${fmtDate(u.lastLogin)}</td>
            <td style="text-align:center;color:var(--text-muted);">${u.loginCount || '—'}</td>
            <td><span class="badge ${isBanned ? 'badge-banned' : 'badge-active'}">${isBanned ? '🚫 Banlı' : '✅ Aktif'}</span></td>
            <td>
                ${!isBanned ? `<button class="admin-btn btn-warning" onclick="adminBanUser('${phone}','')">🚫 Banla</button>` : ''}
                <button class="admin-btn ${isPrem ? 'btn-secondary' : 'btn-premium'}" onclick="togglePremium('${phone}', ${!isPrem})">${isPrem ? '👑 Premium Kaldır' : '⭐ Premium Yap'}</button>
                <button class="admin-btn btn-danger" onclick="removeFromWhitelist('${phone}')">🗑️ Çıkar</button>
            </td>`;
        tbody.appendChild(tr);
    });

    if (sorted.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" style="text-align:center;color:var(--text-muted);padding:24px;">${q ? '🔍 "' + filterQ + '" için sonuç bulunamadı' : 'Henüz kayıtlı kullanıcı yok'}</td></tr>`;
    }
}

// Arama fonksiyonu — render'ı cache'den çağırır, Firebase'e tekrar sorgu atmaz
window.filterUsersTable = function(q) {
    renderUsersTableRows(_cachedUserMap, _cachedBanned, q);
};

// Lider tablosu
function renderLeaderboard() {
    const tbody = document.getElementById('leaderboard-body');
    if (!tbody || !allReportsData) return;
    tbody.innerHTML = '';

    const scores = {};
    Object.values(allReportsData).forEach(r => {
        const p = r.addedBy;
        if (p && p !== 'Bilinmiyor') scores[p] = (scores[p] || 0) + 1;
    });

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const badges = ['🥇', '🥈', '🥉'];

    sorted.slice(0, 20).forEach(([phone, cnt], i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700;color:var(--accent-orange);">#${i + 1}</td>
            <td style="font-family:monospace;">${phone}</td>
            <td>${cnt}</td>
            <td style="color:var(--accent-blue);font-weight:700;">${cnt * 10}</td>
            <td>${badges[i] || '⭐'}</td>`;
        tbody.appendChild(tr);
    });
}

// Grafikler
function initCharts() {
    if (!allReportsData) return;
    const reports = Object.values(allReportsData);

    // Trend - son 7 gün
    const days = [];
    const counts = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const next = new Date(d); next.setDate(next.getDate() + 1);
        days.push(d.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric' }));
        counts.push(reports.filter(r => r.createdAt >= d.getTime() && r.createdAt < next.getTime()).length);
    }

    const trendCtx = document.getElementById('chart-trend');
    if (trendCtx) {
        if (chartTrend) chartTrend.destroy();
        chartTrend = new Chart(trendCtx, {
            type: 'bar',
            data: {
                labels: days,
                datasets: [{ label: 'İhbar', data: counts,
                    backgroundColor: 'rgba(10,132,255,0.6)', borderColor: '#0A84FF',
                    borderWidth: 2, borderRadius: 6 }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#a1a1aa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#a1a1aa', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }

    // Tür dağılımı
    const typeCounts = { radar: 0, kaza: 0, polis: 0 };
    reports.forEach(r => { if (typeCounts[r.type] !== undefined) typeCounts[r.type]++; });

    const typeCtx = document.getElementById('chart-type');
    if (typeCtx) {
        if (chartType) chartType.destroy();
        chartType = new Chart(typeCtx, {
            type: 'doughnut',
            data: {
                labels: ['📸 Radar', '💥 Kaza', '🚓 Polis'],
                datasets: [{ data: [typeCounts.radar, typeCounts.kaza, typeCounts.polis],
                    backgroundColor: ['#FF9F0A', '#FF453A', '#0A84FF'],
                    borderWidth: 0 }]
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#f5f5f7' } } },
                cutout: '60%'
            }
        });
    }
}

// CSV Export
function exportCsv() {
    if (!allReportsData) return;
    const rows = [['Tip', 'Ekleyen', 'Not', 'Tarih', 'Lat', 'Lng', 'Downvote', 'Şikayet']];
    Object.values(allReportsData).forEach(r => {
        const ti = typeConfig[r.type]?.label || r.type;
        const d = new Date(r.createdAt).toLocaleString('tr-TR');
        rows.push([ti, r.addedBy || 'Bilinmiyor', (r.note || '').replace(/,/g, ';'),
                   d, r.lat, r.lng, r.downvotes || 0, r.flags || 0]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `yolradar_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
}

// Admin işlemler
window.adminDeleteReport = function(key) {
    if (!database || !confirm('Bu ihbarı silmek istediğinize emin misiniz?')) return;
    database.ref('reports/' + key).remove();
};

window.adminBanUser = function(phone, _key) {
    if (!database || phone === 'Bilinmiyor') { alert('Numara bilinmiyor, banlanamaz.'); return; }
    if (!confirm(`${phone} numarasını banlamak istediğinize emin misiniz?`)) return;
    database.ref('banned').push(phone).then(() => {
        database.ref('whitelist').once('value').then(snap => {
            const wl = snap.val() || {};
            const upd = {};
            Object.keys(wl).filter(k => wl[k] === phone).forEach(k => { upd[k] = null; });
            if (Object.keys(upd).length) database.ref('whitelist').update(upd);
            allowedPhoneNumbers = allowedPhoneNumbers.filter(n => n !== phone);
            alert(`🚫 ${phone} başarıyla banlandı.`);
        });
    });
};

window.removeFromWhitelist = function(phone) {
    if (!database || !confirm(`${phone} numarasını whitelist'ten çıkarmak istiyor musunuz?`)) return;
    database.ref('whitelist').once('value').then(snap => {
        const wl = snap.val() || {};
        const upd = {};
        Object.keys(wl).filter(k => wl[k] === phone).forEach(k => { upd[k] = null; });
        if (Object.keys(upd).length) {
            database.ref('whitelist').update(upd).then(() => {
                allowedPhoneNumbers = allowedPhoneNumbers.filter(n => n !== phone);
                alert(`✅ ${phone} listeden çıkarıldı.`);
            });
        } else {
            alert('Bu numara Firebase whitelist\'inde bulunamadı.');
        }
    });
};

// ================================================================
// KONUM TAKİBİ
// ================================================================
map.locate({ watch: true, enableHighAccuracy: true });

let lastUserLatLng   = null;
let currentHeading   = 0;
let lastLocationTime = null;
let currentSpeed     = 0;
let currentBypassedCount = 0;
let accuracyCircle   = null;
let lastLocHandled   = 0;         // throttle
let currentSpeedLimit = null;     // OSM hız limiti
let speedLimitDebounce = null;

// ================================================================
// XSS KORUMA — innerHTML injection'a karşı
// ================================================================
function sanitize(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ================================================================
// HIZ LİMİTİ — OSM Nominatim reverse geocode
// ================================================================
async function fetchSpeedLimit(latlng) {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json&extratags=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'tr' } });
        const d   = await res.json();
        const limit = d?.extratags?.maxspeed;
        currentSpeedLimit = limit ? parseInt(limit) : null;
        updateSpeedLimitUI();
    } catch(e) { currentSpeedLimit = null; }
}

function updateSpeedLimitUI() {
    const el = document.getElementById('speed-limit-badge');
    if (!el) return;
    if (currentSpeedLimit && currentSpeedLimit > 0) {
        el.textContent = currentSpeedLimit;
        el.style.display = 'flex';
        // Hız aşımı uyarısı
        el.className = 'speed-limit-badge' + (currentSpeed > currentSpeedLimit ? ' over-limit' : '');
    } else {
        el.style.display = 'none';
    }
}

map.on('locationfound', e => {
    // Throttle: en fazla 1 saniyede bir işle
    const now = Date.now();
    if (now - lastLocHandled < 1000 && lastLocHandled > 0 && !drivingMode) return;
    lastLocHandled = now;

    // 1) Heading hesapla
    if (e.heading !== null && !isNaN(e.heading)) {
        currentHeading = e.heading;
    } else if (lastUserLatLng && drivingMode) {
        const lat1 = lastUserLatLng.lat * Math.PI / 180;
        const lon1 = lastUserLatLng.lng * Math.PI / 180;
        const lat2 = e.latlng.lat * Math.PI / 180;
        const lon2 = e.latlng.lng * Math.PI / 180;
        const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
        currentHeading = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
    }

    // 2) Hız hesapla
    if (e.speed !== null && e.speed !== undefined && !isNaN(e.speed)) {
        currentSpeed = Math.round(e.speed * 3.6);
    } else if (lastUserLatLng && lastLocationTime && drivingMode) {
        const tDiff = (now - lastLocationTime) / 1000;
        if (tDiff > 0) currentSpeed = Math.round((lastUserLatLng.distanceTo(e.latlng) / tDiff) * 3.6);
    }
    lastLocationTime = now;
    lastUserLatLng   = e.latlng;
    userLocation     = e.latlng;

    // 3) Kullanıcı marker ok
    if (!userMarker) {
        userMarker = L.marker(e.latlng, {
            icon: L.divIcon({
                className: 'user-navigation-marker',
                html: `<div class="nav-arrow" id="nav-arrow"></div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            }),
            zIndexOffset: 1000
        }).addTo(map);
    } else {
        userMarker.setLatLng(e.latlng);
    }

    // 4) GPS Accuracy Circle (belirsizlik çemberi)
    if (e.accuracy) {
        if (!accuracyCircle) {
            accuracyCircle = L.circle(e.latlng, {
                radius: e.accuracy,
                color: '#4f8cff',
                fillColor: '#4f8cff',
                fillOpacity: 0.06,
                weight: 1,
                opacity: 0.3
            }).addTo(map);
        } else {
            accuracyCircle.setLatLng(e.latlng).setRadius(e.accuracy);
        }
    }

    // 5) Ok yönü
    const arrowEl = document.getElementById('nav-arrow');
    if (arrowEl) {
        arrowEl.style.transform = `rotate(${currentHeading}deg)`;
        arrowEl.classList.toggle('driving', drivingMode);
    }

    // 6) Hız limiti sorgusu (konumdan her 30 saniyede bir)
    if (drivingMode) {
        clearTimeout(speedLimitDebounce);
        speedLimitDebounce = setTimeout(() => fetchSpeedLimit(e.latlng), 30000);
        if (!currentSpeedLimit) fetchSpeedLimit(e.latlng);
        updateSpeedLimitUI();
    }

    // 7) Sadece ilk konumda haritayı ortala (sonrasında kullanıcı serbestçe gezebilir)
    if (!initialLocationSet) {
        initialLocationSet = true;
        map.setView(e.latlng, 15, { animate: true });
    }
    // NOT: Burada sürekli setView YAPILMIYOR — kullanıcı haritada serbestçe gezebilsin

    // 8) Sürüş modu
    if (drivingMode) {
        setMapBearing(currentHeading);
        map.setView(e.latlng, 18, { animate: true, duration: 0.5 });
        updateDrivingInfo(e.latlng);
        updateCurrentInstruction();
    }

    checkProximityAlerts();
});

map.on('locationerror', () => { /* sessizce geç */ });

// ================================================================
// İHBAR EKLEME - HARİTA TIKLAMASI
// ================================================================
const addModal    = document.getElementById('add-modal');
const btnCancelAdd = document.getElementById('btn-cancel-add');

map.on('click', e => {

    if (!database) { alert('Bağlantı kurulamadı, lütfen sayfayı yenileyin.'); return; }
    if (!userLocation) { alert('Konumunuz henüz alınamadı. Lütfen konum iznini verin ve bekleyin.'); return; }

    const dist        = userLocation.distanceTo(e.latlng);
    const isLongRange = dist > 500;

    // Anti-spam sadece yakın mesafe için geçerli
    if (!isLongRange && !checkAntiSpam(e.latlng)) {
        alert('Son 3 dakika içinde bu bölgeye zaten ihbar eklediniz. Lütfen bekleyin.'); return;
    }

    tempLatLng = e.latlng;

    // Modal içeriğini düzenle (navigasyon gizli — her zaman ihbar modu)
    const typeSelector = document.querySelector('.type-selector');
    const noteInput    = document.getElementById('report-note');
    const modalTitle   = document.querySelector('#add-modal .modal-header h2');

    if (typeSelector) typeSelector.style.display = 'flex';
    if (noteInput)    noteInput.style.display    = 'block';
    if (modalTitle)   modalTitle.textContent     = 'Ne Gördün? 👀';

    addModal.style.display = 'flex';
});

// Modıl içinden 'Yol tarifi al' butonu
document.getElementById('btn-get-directions')?.addEventListener('click', () => {
    if (!tempLatLng) return;
    if (!userLocation) { alert('Konumunuz henüz alınamadı.'); return; }
    const dest = tempLatLng;
    addModal.style.display = 'none';
    tempLatLng = null;
    document.getElementById('report-note').value = '';
    applyRouteWithAvoidance(userLocation, dest, 'Seçilen Konum');
});

btnCancelAdd.addEventListener('click', () => {
    addModal.style.display = 'none';
    tempLatLng = null;
    document.getElementById('report-note').value = '';
});

// Anti-spam: son 3 dakika + 200m yarıçap kontrolü
function checkAntiSpam(latlng) {
    const phone = localStorage.getItem('userPhone');
    if (!phone) return true; // admin veya bilinmeyen → serbest
    const key = 'spam_' + phone;
    const prev = JSON.parse(localStorage.getItem(key) || '[]');
    const now = Date.now();
    const recent = prev.filter(p =>
        (now - p.t < ANTI_SPAM_TIME) && (latlng.distanceTo(L.latLng(p.lat, p.lng)) < ANTI_SPAM_RADIUS)
    );
    return recent.length === 0;
}

function recordAntiSpam(latlng) {
    const phone = localStorage.getItem('userPhone');
    if (!phone) return;
    const key = 'spam_' + phone;
    const prev = JSON.parse(localStorage.getItem(key) || '[]');
    prev.push({ lat: latlng.lat, lng: latlng.lng, t: Date.now() });
    localStorage.setItem(key, JSON.stringify(prev.slice(-20)));
}

// Tür seçimi → Firebase'e kaydet
document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        if (!tempLatLng || !database) return;
        const type = this.getAttribute('data-type');
        const note = (document.getElementById('report-note')?.value || '').trim().substring(0, 120);
        const phone = localStorage.getItem('userPhone') || 'Bilinmiyor';
        const now = Date.now();

        // Aynı türde ve 50m içinde bir rapor var mı kontrol et
        let existingKey = null;
        if (allReportsData) {
            existingKey = Object.keys(allReportsData).find(k => {
                const r = allReportsData[k];
                if (r.type !== type) return false;
                return L.latLng(r.lat, r.lng).distanceTo(tempLatLng) < 50;
            });
        }

        if (existingKey) {
            // Var olan ihbara numarayı ekle (Grupla)
            database.ref('reports/' + existingKey + '/confirmations/' + phone).set(now);
            database.ref('reports/' + existingKey).update({ lastConfirmedAt: now }).then(() => {
                if (phone !== 'Bilinmiyor') updateKarma(phone, 2); // Onaylama için 2 puan
                recordAntiSpam(tempLatLng);
                alert('Bu tehlike daha önce bildirilmişti, onayınız eklendi.');
            });
        } else {
            // Yeni İhbar
            database.ref('reports').push({
                lat: tempLatLng.lat, lng: tempLatLng.lng,
                type, note, addedBy: phone,
                createdAt: now, lastConfirmedAt: now,
                downvotes: 0, flags: 0,
                confirmations: { [phone]: now }
            }).then(() => {
                if (phone !== 'Bilinmiyor') updateKarma(phone, 10);
                recordAntiSpam(tempLatLng);
            });
        }

        addModal.style.display = 'none';
        tempLatLng = null;
        document.getElementById('report-note').value = '';
    });
});

// ================================================================
// GERÇEK ZAMANLI SYNC & MARKER RENDER
// ================================================================
database.ref('reports').on('value', snap => {
        const data = snap.val() || {};
        allReportsData = data;
        // Admin paneli açıksa tabloları güncelle
        const adminOpen = document.getElementById('admin-panel')?.style.display !== 'none';
        if (adminOpen) {
            renderReportsTable(data);
            renderComplaintsTable(data);
            updateStatCards(data);
        }
        const now = Date.now();
        const currentKeys = Object.keys(data);

        // Silinenleri haritadan kaldır
        Object.keys(activeMarkers).forEach(k => {
            if (!currentKeys.includes(k)) {
                markerCluster.removeLayer(activeMarkers[k]);
                delete activeMarkers[k];
                // Çemberini de kaldır
                if (reportCircles[k]) {
                    map.removeLayer(reportCircles[k]);
                    delete reportCircles[k];
                }
            }
        });

        currentKeys.forEach(key => {
            const r = data[key];
            const age = now - r.lastConfirmedAt;
            if (age > ONE_HOUR) {
                database.ref('reports/' + key).remove();
                return;
            }
            if (activeMarkers[key]) return; // zaten var

            const cfg = typeConfig[r.type] || { icon: '❓', label: 'Bilinmiyor' };
            const icon = L.divIcon({
                className: 'custom-marker',
                html: cfg.icon,
                iconSize: [40, 40],
                iconAnchor: [20, 40],
                popupAnchor: [0, -42]
            });

            const marker = L.marker([r.lat, r.lng], { icon });
            marker.reportLabel = cfg.label;
            marker.bindPopup(() => createPopup(key, r), { maxWidth: 280 });
            markerCluster.addLayer(marker);
            activeMarkers[key] = marker;

            // 50m kırmızı tehlike çemberi
            const circleColor = cfg.color || '#FF453A';
            reportCircles[key] = L.circle([r.lat, r.lng], {
                radius: 50,
                color: circleColor,
                fillColor: circleColor,
                fillOpacity: 0.12,
                weight: 2,
                dashArray: '6 4'
            }).addTo(map);
        });
    });

// ================================================================
// POPUP
// ================================================================
function createPopup(key, r) {
    const now = Date.now();
    const mins = Math.floor((now - r.lastConfirmedAt) / 60000);
    const timeText = mins < 1 ? 'Az önce' : `${mins} dakika önce`;
    const cfg = typeConfig[r.type] || { icon: '❓', label: r.type };
    
    // Toplam onay sayısı
    const confCount = r.confirmations ? Object.keys(r.confirmations).length : 1;
    const safeNote = sanitize(r.note);

    // Kendi eklediği raporu kaldırabilsin
    const myPhone = localStorage.getItem('userPhone') || '';
    const isOwner = r.addedBy && r.addedBy === myPhone;

    const div = document.createElement('div');
    div.innerHTML = `
        <div class="popup-title">${cfg.icon} ${cfg.label}</div>
        <div class="popup-time" style="display:flex; justify-content:space-between;">
            <span>⏱ ${timeText}</span>
            <span style="color:#34d399; font-weight:bold;">👍 ${confCount} kişi gördü</span>
        </div>
        ${safeNote ? `<div class="popup-note">💬 "${safeNote}"</div>` : ''}
        <div class="popup-actions" style="margin-top:10px;">
            <button class="btn-confirm"      onclick="confirmReport('${key}')">✅ Ben de Gördüm</button>
            <button class="btn-confirm red"  onclick="rejectReport('${key}')">❌ Artık Yok</button>
        </div>
        <div class="popup-actions" style="margin-top:6px;">
            <button class="btn-confirm gray" onclick="flagReport('${key}')">🚩 Hatalı / Spam</button>
            <button class="btn-confirm gray" onclick="shareReport(${r.lat},${r.lng},'${r.type}')">🔗 Paylaş</button>
        </div>
        ${isOwner ? `<div class="popup-actions" style="margin-top:6px;"><button class="btn-confirm" style="background:#ef4444; width:100%;" onclick="deleteOwnReport('${key}')">🗑️ Bildirimimi Kaldır</button></div>` : ''}`;
    return div;
}

// Onayla
window.confirmReport = function (key) {
    if (!database) return;
    database.ref('reports/' + key).update({ lastConfirmedAt: Date.now() });
    map.closePopup();
};

// Reddet / downvote
window.rejectReport = function (key) {
    if (!database) return;
    const voted = JSON.parse(localStorage.getItem('voted_reports') || '[]');
    if (voted.includes(key)) { alert('Bu ihbar için zaten oy kullandınız.'); return; }

    database.ref('reports/' + key).transaction(rep => {
        if (!rep) return rep;
        rep.downvotes = (rep.downvotes || 0) + 1;
        // ekleyenin karması düşsün
        if (rep.addedBy && rep.addedBy !== 'Bilinmiyor') updateKarma(rep.addedBy, -5);
        if (rep.downvotes >= 3) return null; // sil
        return rep;
    }).then(() => {
        voted.push(key);
        localStorage.setItem('voted_reports', JSON.stringify(voted));
        map.closePopup();
    });
};

// Kendi ihbarını sil
window.deleteOwnReport = function (key) {
    if (!database) return;
    const myPhone = localStorage.getItem('userPhone') || '';
    database.ref('reports/' + key).once('value').then(snap => {
        const r = snap.val();
        if (!r) { alert('Bu ihbar zaten silinmiş.'); return; }
        if (r.addedBy !== myPhone) { alert('Bu ihbarı sadece ekleyen kişi kaldırabilir.'); return; }
        database.ref('reports/' + key).remove().then(() => {
            map.closePopup();
        });
    });
};

// Şikayet / flag
window.flagReport = function (key) {
    if (!database) return;
    const flagged = JSON.parse(localStorage.getItem('flagged_reports') || '[]');
    if (flagged.includes(key)) { alert('Bu ihbarı zaten şikayet ettiniz.'); return; }
    
    const myPhone = localStorage.getItem('userPhone') || 'Misafir';

    database.ref('reports/' + key).transaction(rep => {
        if (!rep) return rep;
        rep.flags = (rep.flags || 0) + 1;
        
        if (!rep.flaggers) rep.flaggers = {};
        rep.flaggers[myPhone] = Date.now();
        
        return rep;
    }).then(() => {
        flagged.push(key);
        localStorage.setItem('flagged_reports', JSON.stringify(flagged));
        map.closePopup();
        alert('🚩 Şikayetiniz alındı, admin inceleyecek.');
    });
};

// ================================================================
// PAYLAŞIM LİNKİ
// ================================================================
window.shareReport = function (lat, lng, type) {
    const url = `${location.origin}${location.pathname}?lat=${lat}&lng=${lng}&type=${type}`;
    if (navigator.share) {
        navigator.share({ title: 'YolRadar İhbarı', url });
    } else {
        navigator.clipboard.writeText(url).then(() => alert('🔗 Link panoya kopyalandı!'));
    }
};

function handleUrlParams() {
    const p = new URLSearchParams(location.search);
    const lat = parseFloat(p.get('lat')), lng = parseFloat(p.get('lng'));
    const type = p.get('type');
    if (!isNaN(lat) && !isNaN(lng)) {
        setTimeout(() => {
            map.setView([lat, lng], 17, { animate: true });
            const cfg = typeConfig[type] || { icon: '📍', label: 'İhbar' };
            L.popup()
                .setLatLng([lat, lng])
                .setContent(`<div class="popup-title">${cfg.icon} ${cfg.label}</div><div class="popup-time">Paylaşılan konum</div>`)
                .openOn(map);
        }, 1000);
    }
}

// ================================================================
// KARMA / PUAN SİSTEMİ
// ================================================================
function updateKarma(phone, delta) {
    if (!database || !phone || phone === 'Bilinmiyor') return;
    database.ref('users/' + phone + '/score').transaction(cur => (cur || 0) + delta);
}

// ================================================================
// SESLI UYARI (MESAFELİ)
// ================================================================
function checkProximityAlerts() {
    if (!userLocation) return;
    Object.keys(activeMarkers).forEach(key => {
        const marker = activeMarkers[key];
        const dist = userLocation.distanceTo(marker.getLatLng());
        if (dist < VOICE_DIST && !alertedMarkers.has(key)) {
            alertedMarkers.add(key);
            const label = marker.reportLabel || 'Tehlike';
            const meters = Math.round(dist);
            const distText = meters < 1000 ? `${meters} metre` : `${(meters / 1000).toFixed(1)} kilometre`;
            speakAlert(`Dikkat! Yaklaşık ${distText} ileride ${label} var.`);
        }
        // 2.5 km'yi geçince uyarı sıfırlansın (tekrar uyarabilsin)
        if (dist > 2500) alertedMarkers.delete(key);
    });
}

function speakAlert(text) {
    if (!voiceEnabled) return;
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'tr-TR'; 
    u.rate = 0.95; 
    u.volume = 1;
    
    // Doğal bir Türkçe sesi bulmaya çalış
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
        // Öncelik sırası: Google Türkçe > Premium > Herhangi bir Türkçe ses
        let trVoice = voices.find(v => v.name.includes('Google') && v.lang.includes('tr')) 
                   || voices.find(v => v.name.includes('Premium') && v.lang.includes('tr'))
                   || voices.find(v => v.lang.includes('tr'));
        if (trVoice) u.voice = trVoice;
    }
    
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
}



// ================================================================
// ROTA ÇİZME — TEHLIKE BYPASS (100m Çember)
// ================================================================

/**
 * Rota koordinatları içinde tehlikeye belirli mesafeden yakın mı?
 */
function isNearRoute(routeCoords, dangerPt, radiusM) {
    return routeCoords.some(c => L.latLng(c.lat, c.lng).distanceTo(dangerPt) < radiusM);
}

/**
 * Tehlike çemberlerini haritada göster (100m kırmızı daire)
 */
function drawDangerCircles(conflicts) {
    clearDangerCircles();
    conflicts.forEach(dp => {
        const circle = L.circle([dp.lat, dp.lng], {
            radius: 100,
            color: '#FF453A',
            fillColor: '#FF453A',
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '8 4'
        }).addTo(map);
        dangerCircles.push(circle);
    });
}

function clearDangerCircles() {
    dangerCircles.forEach(c => map.removeLayer(c));
    dangerCircles = [];
}

/**
 * Tehlike noktası etrafında bypass waypoint'leri hesaplar.
 * Rota yönünü analiz edip, tehlikenin karşı tarafında 3 noktalık
 * bir U-dönüşü oluşturur.
 */
function calcBypassWaypoints(routeCoords, danger, bypassDist) {
    // Rotada tehlikeye en yakın noktayı bul
    let minDist = Infinity, minIdx = 0;
    for (let i = 0; i < routeCoords.length; i++) {
        const d = L.latLng(routeCoords[i].lat, routeCoords[i].lng).distanceTo(danger);
        if (d < minDist) { minDist = d; minIdx = i; }
    }

    // En yakın nokta civarında rota yönünü hesapla
    const lookBack = Math.max(0, minIdx - 10);
    const lookFwd  = Math.min(routeCoords.length - 1, minIdx + 10);
    const routeDirLat = routeCoords[lookFwd].lat - routeCoords[lookBack].lat;
    const routeDirLng = routeCoords[lookFwd].lng - routeCoords[lookBack].lng;
    const routeLen = Math.sqrt(routeDirLat ** 2 + routeDirLng ** 2);
    if (routeLen < 1e-9) return [];

    // Rota yönünde birim vektör
    const rdLat = routeDirLat / routeLen;
    const rdLng = routeDirLng / routeLen;

    // Rota yönüne dik iki seçenek
    const perp1Lat = -rdLng;
    const perp1Lng =  rdLat;

    // Tehlike hangi tarafta? → karşı tarafa bypass yap
    const closest = routeCoords[minIdx];
    const toDangerLat = danger.lat - closest.lat;
    const toDangerLng = danger.lng - closest.lng;
    const dot = toDangerLat * perp1Lat + toDangerLng * perp1Lng;
    const sign = dot >= 0 ? -1 : 1;
    const perpLat = sign * perp1Lat;
    const perpLng = sign * perp1Lng;

    const degOffset = bypassDist / 111111;
    const cosLat = Math.cos(danger.lat * Math.PI / 180);

    // 5 bypass waypoint: Tehlikenin etrafında daha geniş bir yay çiz (tam bypass)
    return [
        // 1. Çok geriden dışa açılma
        L.latLng(
            danger.lat - rdLat * degOffset * 1.5 + perpLat * degOffset * 1.0,
            danger.lng - rdLng * degOffset * 1.5 / cosLat + perpLng * degOffset * 1.0 / cosLat
        ),
        // 2. Tehlikenin çapraz gerisi
        L.latLng(
            danger.lat - rdLat * degOffset * 0.8 + perpLat * degOffset * 1.5,
            danger.lng - rdLng * degOffset * 0.8 / cosLat + perpLng * degOffset * 1.5 / cosLat
        ),
        // 3. Tehlikenin tam karşısı (en uzak nokta)
        L.latLng(
            danger.lat + perpLat * degOffset * 1.8,
            danger.lng + perpLng * degOffset * 1.8 / cosLat
        ),
        // 4. Tehlikenin çapraz ilerisi
        L.latLng(
            danger.lat + rdLat * degOffset * 0.8 + perpLat * degOffset * 1.5,
            danger.lng + rdLng * degOffset * 0.8 / cosLat + perpLng * degOffset * 1.5 / cosLat
        ),
        // 5. Çok ileriden içe kapanma
        L.latLng(
            danger.lat + rdLat * degOffset * 1.5 + perpLat * degOffset * 1.0,
            danger.lng + rdLng * degOffset * 1.5 / cosLat + perpLng * degOffset * 1.0 / cosLat
        )
    ];
}

// ================================================================
// KONUM ARAMA (Nominatim + Yakınlık Öncelikli)
// ================================================================
let searchDebounce = null;

function initSearchBar() {
    const container = document.getElementById('search-container');
    const input   = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    const clearBtn = document.getElementById('search-clear');
    if (!input || !results) return;

    // Giriş yapılmışsa arama çubuğunu göster
    if (localStorage.getItem('isLoggedIn') === 'true' && container) {
        container.style.display = 'block';
    }


    // Yazı yazdıkça ara (debounce 400ms)
    input.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        const q = input.value.trim();
        if (clearBtn) clearBtn.style.display = q ? 'flex' : 'none';
        if (q.length < 2) { results.innerHTML = ''; results.style.display = 'none'; return; }
        searchDebounce = setTimeout(() => searchLocation(q), 400);
    });

    // Temizle butonu
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            input.value = '';
            results.innerHTML = '';
            results.style.display = 'none';
            clearBtn.style.display = 'none';
            input.focus();
        });
    }

    // Dışarı tıklayınca önerileri kapat
    document.addEventListener('click', e => {
        if (!e.target.closest('.search-container')) {
            results.style.display = 'none';
        }
    });

    // Focus → varsa önerileri tekrar göster
    input.addEventListener('focus', () => {
        if (results.children.length > 0) results.style.display = 'block';
    });
}

async function searchLocation(query) {
    const results = document.getElementById('search-results');
    if (!results) return;

    // Kullanıcı konumuna göre viewbox oluştur (±0.3 derece ~ 30km)
    let viewboxParam = '';
    if (userLocation) {
        const lat = userLocation.lat;
        const lng = userLocation.lng;
        const d = 0.3;
        viewboxParam = `&viewbox=${lng - d},${lat - d},${lng + d},${lat + d}&bounded=0`;
    }

    try {
        const url = `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(query)}` +
            `&format=json&limit=6&countrycodes=tr&addressdetails=1` +
            viewboxParam;

        const res = await fetch(url, {
            headers: { 'Accept-Language': 'tr' }
        });
        let data = await res.json();

        // Kullanıcıya yakınlığa göre sırala
        if (userLocation && data.length > 1) {
            data.forEach(item => {
                item._dist = L.latLng(parseFloat(item.lat), parseFloat(item.lon))
                    .distanceTo(userLocation);
            });
            data.sort((a, b) => a._dist - b._dist);
        }

        results.innerHTML = '';
        if (data.length === 0) {
            results.innerHTML = '<div class="search-item search-empty">Sonuç bulunamadı</div>';
            results.style.display = 'block';
            return;
        }

        data.forEach(item => {
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            const dist = userLocation
                ? L.latLng(lat, lon).distanceTo(userLocation)
                : null;
            const distText = dist !== null
                ? (dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`)
                : '';

            // Adres parçaları
            const addr = item.address || {};
            const parts = [addr.neighbourhood, addr.suburb, addr.town || addr.city, addr.province || addr.state]
                .filter(Boolean);
            const subtitle = parts.join(', ') || item.display_name.split(',').slice(1, 3).join(',').trim();

            const div = document.createElement('div');
            div.className = 'search-item';
            div.innerHTML = `
                <div class="search-item-main">
                    <span class="search-item-name">📍 ${item.display_name.split(',')[0]}</span>
                    <span class="search-item-dist">${distText}</span>
                </div>
                <div class="search-item-sub">${subtitle}</div>`;

            div.addEventListener('click', () => {
                const dest = L.latLng(lat, lon);
                results.style.display = 'none';
                
                const shortName = item.display_name.split(',')[0];
                document.getElementById('search-input').value = shortName;

                if (!userLocation) {
                    // Konum yoksa sadece haritada göster
                    map.setView(dest, 16, { animate: true });
                    return;
                }

                // Rota çiz
                applyRouteWithAvoidance(userLocation, dest, shortName);
            });

            results.appendChild(div);
        });

        results.style.display = 'block';
    } catch (err) {
        results.innerHTML = '<div class="search-item search-empty">⚠️ Arama hatası</div>';
        results.style.display = 'block';
    }
}

// Init search bar
document.addEventListener('DOMContentLoaded', initSearchBar);

// ================================================================
// LOCAL CLEANUP (1 dk'da bir eski ihbarları temizle)
// ================================================================
setInterval(() => {
    if (!database) return;
    const now = Date.now();
    // allReportsData zaten memory'de — Firebase'e tekrar sorgu atmaya gerek yok
    Object.keys(allReportsData).forEach(k => {
        if (now - allReportsData[k].lastConfirmedAt > ONE_HOUR) {
            database.ref('reports/' + k).remove();
        }
    });
}, 60000);

// ================================================================
// PROFİL SİSTEMİ
// ================================================================

function openProfileModal() {
    const phone = localStorage.getItem('userPhone');
    if (!phone) return; // admin veya giriş yapılmamış

    const modal = document.getElementById('profile-modal');
    if (!modal) return;
    modal.style.display = 'flex';

    // Tab sistemi
    modal.querySelectorAll('.profile-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            modal.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
            modal.querySelectorAll('.profile-tab-content').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const target = document.getElementById(this.dataset.ptab);
            if (target) target.classList.add('active');
            if (this.dataset.ptab === 'ptab-rank') loadProfileRanking(phone);
        });
    });

    loadProfileData(phone);
    loadProfileStats(phone);
}

function closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.style.display = 'none';
}

function loadProfileData(phone) {
    document.getElementById('profile-display-phone').textContent = '+90 ' + phone;

    if (!database) return;
    database.ref('users/' + phone).once('value').then(snap => {
        const d = snap.val() || {};

        // Üst bar isim
        const displayName = [d.name, d.surname].filter(Boolean).join(' ') || 'İsimsiz Kullanıcı';
        document.getElementById('profile-display-name').textContent = displayName;
        document.getElementById('profile-avatar-display').textContent =
            (d.name ? d.name[0] : '👤').toUpperCase();

        // Form doldur
        document.getElementById('pf-name').value    = d.name    || '';
        document.getElementById('pf-surname').value = d.surname || '';
        document.getElementById('pf-city').value    = d.city    || '';
        document.getElementById('pf-bio').value     = d.bio     || '';
    });
}

window.saveProfile = function() {
    const phone = localStorage.getItem('userPhone');
    if (!phone || !database) return;

    const btn = document.getElementById('pf-save-btn');
    const msg = document.getElementById('pf-save-msg');
    btn.disabled = true;
    btn.textContent = '⏳ Kaydediliyor…';

    const updates = {
        name:    document.getElementById('pf-name').value.trim(),
        surname: document.getElementById('pf-surname').value.trim(),
        city:    document.getElementById('pf-city').value.trim(),
        bio:     document.getElementById('pf-bio').value.trim().substring(0, 120)
    };

    database.ref('users/' + phone).update(updates).then(() => {
        // Üst bar güncelle
        const displayName = [updates.name, updates.surname].filter(Boolean).join(' ') || 'İsimsiz Kullanıcı';
        document.getElementById('profile-display-name').textContent = displayName;
        if (updates.name) document.getElementById('profile-avatar-display').textContent = updates.name[0].toUpperCase();

        msg.textContent = '✅ Kaydedildi!';
        btn.textContent = '💾 Kaydet';
        btn.disabled = false;
        setTimeout(() => { msg.textContent = ''; }, 3000);
    }).catch(() => {
        msg.textContent = '❌ Hata oluştu.';
        btn.textContent = '💾 Kaydet';
        btn.disabled = false;
    });
};

function loadProfileStats(phone) {
    // İhbar istatistiklerini allReportsData'dan hesapla
    let radar = 0, kaza = 0, polis = 0, flags = 0;
    Object.values(allReportsData).forEach(r => {
        if (r.addedBy !== phone) return;
        if (r.type === 'radar') radar++;
        else if (r.type === 'kaza') kaza++;
        else if (r.type === 'polis') polis++;
        if (r.flaggers) flags += Object.keys(r.flaggers).length;
        else flags += (r.flags || 0);
    });
    const total = radar + kaza + polis;

    document.getElementById('ps-radar').textContent = radar;
    document.getElementById('ps-kaza').textContent  = kaza;
    document.getElementById('ps-polis').textContent = polis;
    document.getElementById('ps-flags').textContent = flags;

    // Bar chart
    if (total > 0) {
        document.getElementById('ps-bar-radar').style.width = (radar / total * 100) + '%';
        document.getElementById('ps-bar-kaza').style.width  = (kaza  / total * 100) + '%';
        document.getElementById('ps-bar-polis').style.width = (polis / total * 100) + '%';
    }

    // Firebase'den skor, giriş bilgileri
    if (!database) return;
    database.ref('users/' + phone).once('value').then(snap => {
        const d = snap.val() || {};
        const score = d.score || 0;
        const logins = d.loginCount || 0;

        document.getElementById('ps-score').textContent  = score;
        document.getElementById('ps-logins').textContent = logins;

        function fmtTs(ts) {
            if (!ts) return '—';
            return new Date(ts).toLocaleDateString('tr-TR') + ' ' +
                   new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        }
        document.getElementById('ps-first-login').textContent = fmtTs(d.firstLogin);
        document.getElementById('ps-last-login').textContent  = fmtTs(d.lastLogin);

        // Rozetleri Hesapla ve Göster
        const badgesContainer = document.getElementById('ps-badges-container');
        if (badgesContainer) {
            let badgesHtml = '';
            
            // 1. İhbar Rozetleri
            if (total >= 1)   badgesHtml += `<div class="pf-badge-item" title="İlk ihbarını yaptın!">🥉 Çaylak Gözcü</div>`;
            if (total >= 10)  badgesHtml += `<div class="pf-badge-item" title="10 ihbar barajını aştın!">🥈 Etkin Radarcı</div>`;
            if (total >= 50)  badgesHtml += `<div class="pf-badge-item" title="50 ihbar! Gerçek bir efsane.">🥇 Altın Muhbir</div>`;
            if (total >= 100) badgesHtml += `<div class="pf-badge-item pf-badge-diamond" title="100 ihbar! Sokakların hakimi.">💎 Yol Kurdu</div>`;
            
            // 2. Özel Durum Rozetleri
            if (radar >= 5)   badgesHtml += `<div class="pf-badge-item" style="border-color:#FF9F0A; color:#FF9F0A;">📸 Radar Avcısı</div>`;
            if (kaza >= 5)    badgesHtml += `<div class="pf-badge-item" style="border-color:#FF453A; color:#FF453A;">🚑 Yardımsever</div>`;
            if (logins >= 50) badgesHtml += `<div class="pf-badge-item" style="border-color:#34d399; color:#34d399;">🌟 Müdavim</div>`;
            
            // 3. Yüksek Skor Rozeti
            if (score >= 50)  badgesHtml += `<div class="pf-badge-item" style="border-color:#a78bfa; color:#a78bfa;">⭐ Saygın Üye</div>`;

            if (badgesHtml === '') {
                badgesHtml = '<div style="color:var(--text-muted); font-size:13px; font-style:italic;">Henüz kazanılmış bir rozet yok. İhbar ekleyerek kazanmaya başlayın!</div>';
            }
            badgesContainer.innerHTML = badgesHtml;
        }
    });
}

function loadProfileRanking(myPhone) {
    const container = document.getElementById('pf-rank-list');
    if (!container) return;
    container.innerHTML = '<div class="pf-rank-loading">Yükleniyor…</div>';

    if (!database) return;

    database.ref('users').once('value').then(snap => {
        const usersData = snap.val() || {};

        // Her kullanıcının toplam ihbar sayısını hesapla
        const phoneReports = {};
        Object.values(allReportsData).forEach(r => {
            const p = r.addedBy;
            if (p && p !== 'Bilinmiyor') {
                if (!phoneReports[p]) phoneReports[p] = { radar: 0, kaza: 0, polis: 0 };
                if (r.type === 'radar') phoneReports[p].radar++;
                else if (r.type === 'kaza') phoneReports[p].kaza++;
                else if (r.type === 'polis') phoneReports[p].polis++;
            }
        });

        // Puanlama: skor > ihbar sayısı
        const ranked = Object.keys(usersData).map(p => {
            const ud = usersData[p];
            const rp = phoneReports[p] || { radar: 0, kaza: 0, polis: 0 };
            const total = rp.radar + rp.kaza + rp.polis;
            const displayName = [ud.name, ud.surname].filter(Boolean).join(' ') ||
                                 (p.substring(0, 3) + '***' + p.slice(-2));
            return { phone: p, name: displayName, score: ud.score || 0, total, city: ud.city || '' };
        }).sort((a, b) => b.score !== a.score ? b.score - a.score : b.total - a.total);

        // Benim yerim
        let myRank = ranked.findIndex(r => r.phone === myPhone) + 1;

        container.innerHTML = '';

        if (ranked.length === 0) {
            container.innerHTML = '<div class="pf-rank-loading">Henüz veri yok</div>';
            return;
        }

        ranked.slice(0, 30).forEach((user, i) => {
            const rank = i + 1;
            const isMe = user.phone === myPhone;
            const posClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
            const posLabel = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank;

            const row = document.createElement('div');
            row.className = 'pf-rank-row' + (isMe ? ' is-me' : '');
            row.innerHTML = `
                <div class="pf-rank-pos ${posClass}">${posLabel}</div>
                <div class="pf-rank-name">
                    <div class="pf-rank-name-main">${user.name}${isMe ? ' <span style="color:var(--accent-blue);font-size:11px;">(Sen)</span>' : ''}</div>
                    <div class="pf-rank-name-sub">${user.city ? user.city + ' · ' : ''}${user.total} ihbar</div>
                </div>
                <div class="pf-rank-score">
                    <div class="pf-rank-score-val">${user.score}</div>
                    <div class="pf-rank-score-lbl">puan</div>
                </div>`;
            container.appendChild(row);
        });

        // Eğer sıralamada yoksa veya 30'un dışındaysa altına ekle
        if (myRank > 30 || myRank === 0) {
            const myData = ranked.find(r => r.phone === myPhone);
            if (myData) {
                const sep = document.createElement('div');
                sep.style.cssText = 'text-align:center;color:var(--text-muted);font-size:12px;padding:4px 0;';
                sep.textContent = `· · ·  Sen #${myRank} sıradasın  · · ·`;
                container.appendChild(sep);

                const myRow = document.createElement('div');
                myRow.className = 'pf-rank-row is-me';
                myRow.innerHTML = `
                    <div class="pf-rank-pos">${myRank}</div>
                    <div class="pf-rank-name">
                        <div class="pf-rank-name-main">${myData.name} <span style="color:var(--accent-blue);font-size:11px;">(Sen)</span></div>
                        <div class="pf-rank-name-sub">${myData.city ? myData.city + ' · ' : ''}${myData.total} ihbar</div>
                    </div>
                    <div class="pf-rank-score">
                        <div class="pf-rank-score-val">${myData.score}</div>
                        <div class="pf-rank-score-lbl">puan</div>
                    </div>`;
                container.appendChild(myRow);
            }
        }
    });
}

// DOMContentLoaded'da tab init
document.addEventListener('DOMContentLoaded', () => {
    // Profil ve yardım butonları sadece giriş yapılmışsa görünsün
    const btnProfile = document.getElementById('btn-profile');
    const btnHelp = document.getElementById('btn-help');
    const btnShare = document.getElementById('btn-share');
    if (localStorage.getItem('isLoggedIn') === 'true') {
        if (btnProfile) btnProfile.style.display = 'flex';
        if (btnHelp) btnHelp.style.display = 'flex';
        if (btnShare) btnShare.style.display = 'flex';
    }
});

// ================================================================
// YENİ ROTA SİSTEMİ — Profesyonel Yeniden Tasarım
// ================================================================

let routeDestName = 'Hedef'; // Hedef konum adı (arama çubuğundan gelir)
let routeTotalDistKm = 0;
let routeTotalDurMin = 0;

/**
 * Rota panelini "hesaplanıyor" moduna al
 */
function showRouteCalculating(msg) {
    const panel = document.getElementById('routing-panel');
    if (panel) panel.style.display = 'block';
    document.getElementById('route-calculating').style.display = 'flex';
    document.getElementById('route-summary').style.display = 'none';
    if (msg) document.getElementById('routing-status').textContent = msg;
}

/**
 * Rota özet kartını doldur ve göster
 */
function showRouteSummary({ distKm, durMin, dangerCount, bypassedCount, destName }) {
    document.getElementById('route-calculating').style.display = 'none';
    const summary = document.getElementById('route-summary');
    summary.style.display = 'block';

    // Metrikler
    document.getElementById('rm-dist').textContent = distKm.toFixed(1);
    document.getElementById('rm-dur').textContent  = durMin < 60
        ? Math.round(durMin)
        : `${Math.floor(durMin / 60)}sa ${Math.round(durMin % 60)}`;

    const arrivalTime = new Date(Date.now() + durMin * 60000);
    document.getElementById('rm-eta').textContent = arrivalTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    // Hedef etiketi
    if (destName) document.getElementById('route-to-label').textContent = destName;

    // Tehlike bannerı
    const dangerBanner = document.getElementById('route-danger-banner');
    const cleanBanner  = document.getElementById('route-clean-banner');
    if (dangerCount > 0) {
        dangerBanner.style.display = 'flex';
        cleanBanner.style.display  = 'none';
        document.getElementById('route-danger-text').textContent =
            `${dangerCount} tehlike tespit edildi — ${bypassedCount > 0 ? bypassedCount + ' bypass uygulandı' : 'dikkatli olun'}`;
    } else {
        dangerBanner.style.display = 'none';
        cleanBanner.style.display  = 'flex';
    }

    // Sürüşe başla butonu
    document.getElementById('btn-start-driving').style.display = 'flex';

    // Sürüş hazır durumunda tehlike sayacını güncelle
    const hazardEl = document.getElementById('drv-hazard-num');
    if (hazardEl) hazardEl.textContent = dangerCount;
    if (dangerCount > 0) {
        document.getElementById('drv-hazard-count').style.display = 'flex';
    }

    // Kaydet
    routeTotalDistKm = distKm;
    routeTotalDurMin = durMin;
}

/**
 * Ana rota fonksiyonu — tamamen yeniden yazıldı
 */
async function applyRouteWithAvoidance(from, to, destName) {
    if (!from) { alert('Konumunuz henüz alınamadı.'); return; }
    clearRoute(false); // rota panelini koru
    routeDestName = destName || 'Hedef';

    showRouteCalculating('⏳ Rota hesaplanıyor…');

    const AVOID_RADIUS = 100;
    const BYPASS_DIST  = 280;

    try {
        // 1) OSRM'den taslak rota
        const res  = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
        );
        const json = await res.json();

        let waypoints = [from, to];
        let distKm = 0, durMin = 0;
        let dangerCount = 0, bypassedCount = 0;

        if (json.routes?.length) {
            const route  = json.routes[0];
            distKm = route.distance / 1000;
            durMin = route.duration / 60;

            const coords = route.geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));

            // 2) Güzergah üzerindeki tehlikeleri bul
            const conflicts = [];
            Object.values(allReportsData).forEach(r => {
                const dp = L.latLng(r.lat, r.lng);
                if (isNearRoute(coords, dp, AVOID_RADIUS)) conflicts.push({ latlng: dp, type: r.type });
            });
            dangerCount = conflicts.length;

            if (conflicts.length > 0) {
                // Görsel tehlike çemberlerini çiz
                clearDangerCircles();
                conflicts.forEach(({ latlng, type }) => {
                    const color = typeConfig[type]?.color || '#FF453A';
                    dangerCircles.push(
                        L.circle(latlng, {
                            radius: 120, color, fillColor: color, fillOpacity: 0.12, weight: 2, dashArray: '8 4'
                        }).addTo(map)
                    );
                });

                // Bypass waypoint hesapla
                let allBypasses = [];
                conflicts.forEach(({ latlng }) => {
                    const bps = calcBypassWaypoints(coords, latlng, BYPASS_DIST);
                    allBypasses.push(...bps);
                });

                // Waypoint'leri rota yönünde sırala
                const dLat = to.lat - from.lat, dLng = to.lng - from.lng;
                const len2 = dLat ** 2 + dLng ** 2;
                allBypasses.sort((a, b) => {
                    const tA = ((a.lat - from.lat) * dLat + (a.lng - from.lng) * dLng) / len2;
                    const tB = ((b.lat - from.lat) * dLat + (b.lng - from.lng) * dLng) / len2;
                    return tA - tB;
                });

                waypoints = [from, ...allBypasses, to];
                bypassedCount = conflicts.length;

                speakAlert(`Dikkat! Güzergahınızda ${conflicts.length} tehlike var. Rota güvenli şekilde yeniden hesaplandı.`);
            }
        }

        // 3) Leaflet Routing Machine ile çiz
        routingControl = L.Routing.control({
            waypoints,
            routeWhileDragging: false,
            showAlternatives: false,
            fitSelectedRoutes: true,
            show: false,
            collapsible: false,
            lineOptions: {
                styles: [
                    { color: 'rgba(255,255,255,0.15)', weight: 12, opacity: 1 },
                    { color: dangerCount > 0 ? '#FF9F0A' : '#30D158', weight: 7, opacity: 0.95 }
                ]
            },
            router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1', language: 'tr' }),
            createMarker: (i, wp, nWps) => {
                if (i === 0) return L.marker(wp.latLng, {
                    icon: L.divIcon({
                        className: '',
                        html: `<div style="width:18px;height:18px;background:#30D158;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(48,209,88,0.3);"></div>`,
                        iconSize: [18, 18], iconAnchor: [9, 9]
                    })
                });
                if (i === nWps - 1) return L.marker(wp.latLng, {
                    icon: L.divIcon({
                        className: '',
                        html: `<div style="width:14px;height:24px;position:relative;"><div style="width:14px;height:14px;background:#FF453A;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(255,69,58,0.3);"></div><div style="width:2px;height:12px;background:#FF453A;margin:0 auto;opacity:0.6;"></div></div>`,
                        iconSize: [14, 26], iconAnchor: [7, 26]
                    })
                });
                return null;
            }
        }).addTo(map);

        // 4) Rota bulununca özet güncelle + adımları parse et
        routingControl.on('routesfound', e => {
            if (e.routes?.length) {
                const r = e.routes[0];
                const actualDist = r.summary.totalDistance / 1000;
                const actualDur  = r.summary.totalTime / 60;
                showRouteSummary({
                    distKm: actualDist,
                    durMin: actualDur,
                    dangerCount,
                    bypassedCount,
                    destName: routeDestName
                });
                // Turn-by-turn adımlarını parse et
                routeSteps = parseRouteSteps(r);
                currentStepIdx = 0;
                lastVoiceStepIdx = -1;
                // İlk talimatı göster
                if (routeSteps.length) {
                    const first = routeSteps[0];
                    const dEl = document.getElementById('drv-instr-dist');
                    const lEl = document.getElementById('drv-instr-label');
                    const iEl = document.getElementById('drv-instr-icon');
                    if (dEl) dEl.textContent = first.distance < 1000 ? `${Math.round(first.distance)} m` : `${(first.distance/1000).toFixed(1)} km`;
                    if (lEl) lEl.textContent = first.text;
                    if (iEl) iEl.innerHTML = getManeuverSvg(first.type);
                }
            }
        });

        // OSRM'den gelmiş metrikler varsa hemen göster (LRM yanıt geç gelebilir)
        if (distKm > 0) {
            showRouteSummary({ distKm, durMin, dangerCount, bypassedCount, destName: routeDestName });
        }

    } catch (err) {
        console.warn('Rota hatası:', err);
        showRouteCalculating('❌ Rota hesaplanamadı — tekrar deneyin');
        // Fallback: direkt çiz
        try {
            routingControl = L.Routing.control({
                waypoints: [from, to], routeWhileDragging: false, showAlternatives: false,
                fitSelectedRoutes: true, show: false, collapsible: false,
                lineOptions: { styles: [{ color: '#4f8cff', weight: 6, opacity: 0.85 }] },
                router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1', language: 'tr' }),
                createMarker: () => null
            }).addTo(map);
            routingControl.on('routesfound', e => {
                if (e.routes?.length) {
                    const r = e.routes[0];
                    showRouteSummary({
                        distKm: r.summary.totalDistance / 1000,
                        durMin: r.summary.totalTime / 60,
                        dangerCount: 0, bypassedCount: 0, destName: routeDestName
                    });
                }
            });
        } catch(e2) {}
    }
}

// showDrivingButton artık gerekmiyor — showRouteSummary içinde yapılıyor
function showDrivingButton() {
    const btn = document.getElementById('btn-start-driving');
    if (btn) btn.style.display = 'flex';
}

function startDrivingMode() {
    drivingMode = true;
    // Adım sayıcıları sıfırla
    currentStepIdx = 0;
    lastVoiceStepIdx = -1;
    document.getElementById('routing-panel').style.display = 'none';
    document.getElementById('driving-bottom-bar').style.display = 'flex';
    document.getElementById('btn-quick-report-float').style.display = 'flex';
    document.body.classList.add('driving-active');

    // Talimat başlangıcı
    if (routeDestName) {
        const lEl = document.getElementById('drv-instr-label');
        if (lEl && routeSteps.length) lEl.textContent = routeSteps[0]?.text || routeDestName + ' yönüne gidin';
    }

    if (userLocation) {
        setMapBearing(currentHeading);
        map.setView(userLocation, 17, { animate: true });
        updateDrivingInfo(userLocation);
    }
    speakAlert('Navigasyon başladı. İyi yolculuklar!');
}

function stopDrivingMode() {
    drivingMode = false;
    document.getElementById('driving-bottom-bar').style.display = 'none';
    document.getElementById('btn-quick-report-float').style.display = 'none';
    document.body.classList.remove('driving-active');
    // Rota hala varsa paneli geri göster
    if (routingControl) {
        document.getElementById('routing-panel').style.display = 'block';
        document.getElementById('btn-start-driving').style.display = 'flex';
    }
}

function updateDrivingInfo(latlng) {
    if (!routingControl) return;
    const wps = routingControl.getWaypoints();
    if (!wps.length) return;
    const dest = wps[wps.length - 1].latLng;
    if (!dest) return;

    const dist = latlng.distanceTo(dest); // metre

    // Hız
    document.getElementById('apple-speed').textContent = currentSpeed;

    // Mesafe metni
    const distText = dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`;

    // ETA
    const etaEl     = document.getElementById('apple-eta');
    const distSubEl = document.getElementById('apple-dist-time');
    if (etaEl && distSubEl) {
        const avgKmH   = currentSpeed > 10 ? currentSpeed : 30;
        const timeMins = Math.ceil((dist / 1000) / avgKmH * 60);
        const etaText  = timeMins < 60 ? `${timeMins} dk` : `${Math.floor(timeMins / 60)}sa ${timeMins % 60}dk`;
        etaEl.textContent = etaText;
        etaEl.className   = 'drv-eta-time' + (timeMins > 60 ? ' urgent' : '');

        const arrival = new Date(Date.now() + timeMins * 60000);
        const timeStr = arrival.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        distSubEl.textContent = `${distText} • ${timeStr}`;
    }

    // Talimat mesafesi
    const instrDist = document.getElementById('drv-instr-dist');
    if (instrDist) instrDist.textContent = distText;

    // Yakın tehlikeleri kontrol et (sürüş esnasında anlık uyarı)
    let nearbyHazards = 0;
    Object.values(allReportsData).forEach(r => {
        if (latlng.distanceTo(L.latLng(r.lat, r.lng)) < 500) nearbyHazards++;
    });
    const hazardCount = document.getElementById('drv-hazard-count');
    if (hazardCount) {
        if (nearbyHazards > 0) {
            hazardCount.style.display = 'flex';
            document.getElementById('drv-hazard-num').textContent = nearbyHazards;
        } else {
            hazardCount.style.display = 'none';
        }
    }

    // Varış kontrolü
    if (dist < 35) {
        speakAlert('Hedefe ulaştınız, geçmiş olsun!');
        stopDrivingMode();
        clearRoute();
    }
}

function clearRoute(hidePanel = true) {
    drivingMode = false;
    document.getElementById('driving-bottom-bar').style.display = 'none';
    document.getElementById('btn-quick-report-float').style.display = 'none';
    document.body.classList.remove('driving-active');
    if (routingControl) { map.removeControl(routingControl); routingControl = null; }
    clearDangerCircles();
    if (hidePanel) {
        const panel = document.getElementById('routing-panel');
        if (panel) panel.style.display = 'none';
    }
    document.getElementById('btn-start-driving').style.display = 'none';
    routeTotalDistKm = 0; routeTotalDurMin = 0;
}

// ================================================================
// TURN-BY-TURN NAVİGASYON SİSTEMİ
// ================================================================

let routeSteps = [];      // Tüm adımlar
let currentStepIdx = 0;   // Şu anki adım indeksi
let lastVoiceStepIdx = -1;// Son sesli uyarı verilen adım

/**
 * Dönüş tipine göre SVG yol tarifi ikonu
 */
function getManeuverSvg(type) {
    const path = {
        'Head':              'M12 19V5m0 0-5 5m5-5 5 5',
        'Straight':          'M12 19V5m0 0-5 5m5-5 5 5',
        'Continue':          'M12 19V5m0 0-5 5m5-5 5 5',
        'SlightRight':       'M6 18 17 7m0 0H7m10 0v10',
        'Right':             'M5 12h14m0 0-5-5m5 5-5 5',
        'SharpRight':        'M5 12h14m0 0-5-5m5 5-5 5M15 5v14',
        'SlightLeft':        'M18 18 7 7m0 0v10m0-10h10',
        'Left':              'M19 12H5m0 0 5-5m-5 5 5 5',
        'SharpLeft':         'M19 12H5m0 0 5-5m-5 5 5 5M9 5v14',
        'TurnAround':        'M4 12a8 8 0 0 0 16 0M12 8l4 4-4 4',
        'Roundabout':        'M12 2a10 10 0 1 0 10 10M17 12l-5-5-5 5',
        'ExitRoundabout':    'M12 2a10 10 0 1 0 10 10M5 12h7l-3-3m3 3-3 3',
        'DestinationReached':'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
    };
    const d = path[type] || path['Straight'];
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

/**
 * LRM route.instructions dizisini parse et
 * Bypass waypoint'lerini ("WaypointReached") filtrele
 */
function parseRouteSteps(route) {
    if (!route || !route.instructions) return [];
    return route.instructions
        .filter(s => s.type !== 'WaypointReached')
        .map(s => ({
            text:     s.text || 'Devam edin',
            road:     s.road || '',
            type:     s.type || 'Straight',
            distance: s.distance || 0,       // bu adımın mesafesi (m)
            index:    s.index || 0,          // koordinat dizisindeki index
            latlng:   route.coordinates[s.index] || null
        }));
}

/**
 * Kullanıcının şu an hangi adımda olduğunu hesapla ve UI'yi güncelle
 */
function updateCurrentInstruction() {
    if (!routeSteps.length || !userLocation) return;

    // İleri adımlara geç — kullanıcı adımın maneuver noktasına 40m yakınsa
    while (currentStepIdx < routeSteps.length - 1) {
        const step = routeSteps[currentStepIdx];
        if (!step.latlng) { currentStepIdx++; continue; }
        const distToStepPt = userLocation.distanceTo(
            L.latLng(step.latlng.lat, step.latlng.lng)
        );
        if (distToStepPt < 40) {
            currentStepIdx++;
        } else {
            break;
        }
    }

    const step = routeSteps[currentStepIdx];
    if (!step) return;

    // Bu adımın maneuver noktasına kalan mesafe
    let distToNext = step.distance;
    if (step.latlng) {
        distToNext = userLocation.distanceTo(L.latLng(step.latlng.lat, step.latlng.lng));
    }

    const distText = distToNext < 1000
        ? `${Math.round(distToNext / 10) * 10} m`
        : `${(distToNext / 1000).toFixed(1)} km`;

    // UI güncelle
    const iconEl  = document.getElementById('drv-instr-icon');
    const distEl  = document.getElementById('drv-instr-dist');
    const labelEl = document.getElementById('drv-instr-label');

    if (iconEl)  iconEl.innerHTML  = getManeuverSvg(step.type);
    if (distEl)  distEl.textContent  = distText;
    if (labelEl) labelEl.textContent = step.text;

    // 200m yakınında sesli uyarı (bir kez)
    if (distToNext < 200 && distToNext > 50 && currentStepIdx !== lastVoiceStepIdx) {
        lastVoiceStepIdx = currentStepIdx;
        speakAlert(distText + ' sonra ' + step.text);
    }
}

/**
 * Sürüş bitince haritayı kuzey-yukan (bearing 0) sıfırla
 */
function setMapBearing(bearing) {
    try {
        if (map && typeof map.setBearing === 'function') { map.setBearing(bearing); return; }
    } catch(e) {}
    const mapEl = document.getElementById('map');
    if (mapEl) mapEl.style.transform = `rotate(${-bearing}deg) scale(1.15)`;
}
function resetMapBearing() {
    try {
        if (map && typeof map.setBearing === 'function') { map.setBearing(0); return; }
    } catch(e) {}
    const mapEl = document.getElementById('map');
    if (mapEl) mapEl.style.transform = '';
}

// ================================================================
// NAV OK MARKERİ — CSS'ten yönetildiği için JS'te sadece heading
// ================================================================
// Mevcut nav-arrow elementi heading güncellemesini locationfound'da yapıyor.
// Nav ok CSS'te .nav-arrow + .driving ile görsel olarak değişiyor.
// Burada ekstra bir şey yapmamıza gerek yok.



// ================================================================
// WHATSAPP PAYLAŞIMI
// ================================================================
window.shareHazards = function() {
    if (!userLocation) {
        alert('Konumunuz henüz bulunamadı.');
        return;
    }

    const radius = 5000; // 5km içindeki tehlikeler
    let nearby = [];
    Object.values(allReportsData).forEach(r => {
        if (!r.lat || !r.lng) return;
        const dist = userLocation.distanceTo(L.latLng(r.lat, r.lng));
        if (dist <= radius) {
            nearby.push({ ...r, dist: Math.round(dist) });
        }
    });

    if (nearby.length === 0) {
        alert('Çevrenizde (5km) bildirilecek tehlike bulunmuyor.');
        return;
    }

    // Mesafe sırasına göre diz
    nearby.sort((a, b) => a.dist - b.dist);

    let text = `🚨 *YolRadar Anlık Trafik Bildirimi* 🚨\n📍 _Konumuma ${radius/1000}km çapında ${nearby.length} tehlike var:_\n\n`;
    
    nearby.slice(0, 10).forEach((n, i) => { // En yakın 10'unu al
        const icon = typeConfig[n.type]?.icon || '❓';
        const typeName = typeConfig[n.type]?.label || n.type;
        const note = n.note ? ` - "${n.note}"` : '';
        text += `${icon} *${typeName}* (${n.dist}m)${note}\n`;
    });

    text += `\n🗺️ Detaylar için: https://yolradar.com`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
};


// ================================================================
// KARANLIK NOKTA (HOTSPOT) ANALİZİ
// ================================================================
function renderHotspotsTab() {
    const tbody = document.getElementById('hotspots-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">Hesaplanıyor…</td></tr>';

    // Grid-based clustering (yaklaşık 100m - 200m hassasiyet)
    const gridSize = 0.002; 
    const clusters = {};

    Object.values(allReportsData).forEach(r => {
        if (!r.lat || !r.lng) return;
        const gridLat = Math.round(r.lat / gridSize) * gridSize;
        const gridLng = Math.round(r.lng / gridSize) * gridSize;
        const key = `${gridLat.toFixed(4)},${gridLng.toFixed(4)}`;

        if (!clusters[key]) {
            clusters[key] = { lat: gridLat, lng: gridLng, count: 0, reports: [] };
        }
        clusters[key].count++;
        clusters[key].reports.push(r);
    });

    const sorted = Object.values(clusters)
        .filter(c => c.count > 1) // En az 2 ihbar olan yerler
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // İlk 10

    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">Yeterli veri yok (Kesişen ihbar bulunamadı).</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    sorted.forEach((c, idx) => {
        let intensity = 'Düşük';
        let color = '#34d399';
        if (c.count >= 5) { intensity = 'Yüksek'; color = '#ef4444'; }
        else if (c.count >= 3) { intensity = 'Orta'; color = '#f59e0b'; }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td style="font-family:monospace; font-size:12px;">${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}</td>
            <td style="text-align:center; font-weight:bold;">${c.count}</td>
            <td style="color:${color}; font-weight:600;">${intensity}</td>
            <td>
                <button class="admin-btn" style="background:#4f8cff; color:#fff;" onclick="map.setView([${c.lat}, ${c.lng}], 16, {animate:true}); document.getElementById('admin-panel').style.display='none';">🗺️ Haritaya Git</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}


// ================================================================
// CANLI KONUM PAYLASIMI (PREMIUM)
// ================================================================
let locationSharingEnabled = localStorage.getItem('shareLocation') === 'true';
let liveUserMarkers = {};
let lastLiveLocUpdate = 0;

document.addEventListener('DOMContentLoaded', () => {
    const cb = document.getElementById('pf-share-location');
    if (cb) cb.checked = locationSharingEnabled;
});

window.toggleLocationSharing = function(enabled) {
    if (enabled && !isPremiumUser) {
        // Premium değilse toggle'ı geri kapat ve modal göster
        const cb = document.getElementById('pf-share-location');
        if (cb) cb.checked = false;
        showPremiumModal();
        return;
    }
    locationSharingEnabled = enabled;
    localStorage.setItem('shareLocation', enabled ? 'true' : 'false');
    if (!enabled) {
        const phone = localStorage.getItem('userPhone');
        if (phone && database) database.ref('liveLocations/' + phone).remove();
        Object.keys(liveUserMarkers).forEach(k => {
            map.removeLayer(liveUserMarkers[k]);
            delete liveUserMarkers[k];
        });
    }
};

function pushMyLocation() {
    if (!locationSharingEnabled || !database || !userLocation) return;
    const now = Date.now();
    if (now - lastLiveLocUpdate < 15000) return;
    lastLiveLocUpdate = now;
    const phone = localStorage.getItem('userPhone');
    if (!phone) return;
    database.ref('liveLocations/' + phone).set({
        lat: userLocation.lat, lng: userLocation.lng,
        timestamp: now, phone: phone,
        name: localStorage.getItem('userName') || ''
    });
}

function listenLiveLocations() {
    if (!database) return;
    database.ref('liveLocations').on('value', snap => {
        const data = snap.val() || {};
        const myPhone = localStorage.getItem('userPhone') || '';
        const isAdmin = localStorage.getItem('userRole') === 'admin';
        const now = Date.now();
        const TIMEOUT = 5 * 60 * 1000;
        Object.keys(liveUserMarkers).forEach(k => {
            if (!data[k]) { map.removeLayer(liveUserMarkers[k]); delete liveUserMarkers[k]; }
        });
        Object.keys(data).forEach(phone => {
            if (phone === myPhone) return;
            const loc = data[phone];
            if (now - loc.timestamp > TIMEOUT) { database.ref('liveLocations/' + phone).remove(); return; }
            if (!isAdmin && !locationSharingEnabled) return;
            const displayName = loc.name || phone.slice(-4);
            if (liveUserMarkers[phone]) {
                liveUserMarkers[phone].setLatLng([loc.lat, loc.lng]);
            } else {
                const icon = L.divIcon({
                    className: 'live-user-marker',
                    html: '<div class="live-user-dot"><span class="live-user-label">' + sanitize(displayName) + '</span></div>',
                    iconSize: [14, 14], iconAnchor: [7, 7]
                });
                liveUserMarkers[phone] = L.marker([loc.lat, loc.lng], { icon, zIndexOffset: 500 }).addTo(map);
            }
        });
    });
}
listenLiveLocations();
map.on('locationfound', () => { pushMyLocation(); });

window.addEventListener('beforeunload', () => {
    const phone = localStorage.getItem('userPhone');
    if (phone && database) database.ref('liveLocations/' + phone).remove();
});

const _origSaveProfile = window.saveProfile;
window.saveProfile = function() {
    const n = document.getElementById('pf-name')?.value?.trim() || '';
    const s = document.getElementById('pf-surname')?.value?.trim() || '';
    localStorage.setItem('userName', [n, s].filter(Boolean).join(' '));
    if (_origSaveProfile) _origSaveProfile();
};

// ================================================================
// SOS ACIL YARDIM SISTEMI (PREMIUM)
// ================================================================
let currentSOSData = null;
let sosAlertedKeys = new Set();

window.sendSOS = function() {
    // Premium kontrolü
    if (!isPremiumUser) {
        showPremiumModal();
        return;
    }
    if (!database || !userLocation) {
        alert('Konum bilginiz alinamadi. Lutfen konumunuza izin verin.');
        return;
    }
    const phone = localStorage.getItem('userPhone') || 'Bilinmiyor';
    const name = localStorage.getItem('userName') || 'Isimsiz Kullanici';
    if (!confirm('ACiL YARDIM CAGRISI gonderilecek!\n\nYakininmdaki tum kullanicilara acil uyari iletilecek.\n\nDevam etmek istiyor musunuz?')) return;
    database.ref('emergencies').push({
        lat: userLocation.lat, lng: userLocation.lng,
        phone: phone, name: name,
        timestamp: Date.now(), active: true
    }).then(() => {
        alert('Acil yardim cagriniz gonderildi!\nYakininzdaki kullanicilar bilgilendirilecek.');
    });
};

function listenEmergencies() {
    if (!database) return;
    database.ref('emergencies').on('child_added', snap => {
        const data = snap.val();
        const key = snap.key;
        if (!data || !data.active) return;
        const now = Date.now();
        if (now - data.timestamp > 30 * 60 * 1000) { database.ref('emergencies/' + key).remove(); return; }
        const myPhone = localStorage.getItem('userPhone') || '';
        if (data.phone === myPhone) return;
        if (sosAlertedKeys.has(key)) return;
        if (!userLocation) return;
        const dist = userLocation.distanceTo(L.latLng(data.lat, data.lng));
        if (dist > 10000) return;
        sosAlertedKeys.add(key);
        showSOSAlert(key, data, dist);
    });
}

function showSOSAlert(key, data, dist) {
    currentSOSData = { key, ...data };
    document.getElementById('sos-caller-name').textContent = data.name || 'Isimsiz';
    document.getElementById('sos-caller-phone').textContent = data.phone || '—';
    const distText = dist < 1000 ? Math.round(dist) + ' metre' : (dist / 1000).toFixed(1) + ' km';
    document.getElementById('sos-caller-dist').textContent = distText + ' uzaklikta';
    document.getElementById('sos-alert-modal').style.display = 'flex';
    speakAlert('Dikkat! Acil yardim cagrisi! ' + (data.name || 'Bir kullanici') + ' yardim istiyor, ' + distText + ' uzaklikta.');
    if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
}

window.routeToSOS = function() {
    if (!currentSOSData) return;
    document.getElementById('sos-alert-modal').style.display = 'none';
    const dest = L.latLng(currentSOSData.lat, currentSOSData.lng);
    map.setView(dest, 15, { animate: true });
    const sosMarker = L.marker(dest, {
        icon: L.divIcon({ className: 'sos-map-marker', html: '\uD83D\uDEA8', iconSize: [40, 40], iconAnchor: [20, 40] }),
        zIndexOffset: 2000
    }).addTo(map).bindPopup('<div class="popup-title">\uD83D\uDEA8 Acil Yardim</div><div class="popup-note">' + sanitize(currentSOSData.name) + ' yardim istiyor</div>').openPopup();
    setTimeout(() => { map.removeLayer(sosMarker); }, 30 * 60 * 1000);
    if (userLocation && typeof L.Routing !== 'undefined') {
        if (routingControl) map.removeControl(routingControl);
        routingControl = L.Routing.control({
            waypoints: [userLocation, dest],
            routeWhileDragging: false, addWaypoints: false, show: false,
            lineOptions: { styles: [{ color: '#ef4444', weight: 5, opacity: 0.8 }] },
            createMarker: () => null
        }).addTo(map);
    }
};

window.dismissSOS = function() {
    document.getElementById('sos-alert-modal').style.display = 'none';
    if (window.speechSynthesis) window.speechSynthesis.cancel();
};

listenEmergencies();

// ================================================================
// PREMIUM ÜYELİK SİSTEMİ
// ================================================================

/**
 * Firebase'den kullanıcının premium durumunu kontrol et
 * ve UI'yi buna göre güncelle
 */
window.checkPremiumStatus = function() {
    const phone = localStorage.getItem('userPhone');
    if (!phone || !database) return;
    
    database.ref('users/' + phone + '/premium').on('value', snap => {
        isPremiumUser = snap.val() === true;
        console.log('[Premium] Durum güncellendi:', isPremiumUser, 'Telefon:', phone);
        updatePremiumUI();
    });
};

/**
 * Premium durumuna göre UI elementlerini güncelle
 */
function updatePremiumUI() {
    const sosBtn = document.getElementById('btn-sos');
    const shareToggle = document.getElementById('pf-share-location');
    const premiumBadge = document.getElementById('premium-profile-badge');
    
    if (sosBtn) {
        sosBtn.classList.toggle('premium-locked', !isPremiumUser);
    }
    
    // Konum paylaşım toggle'ını güncelle
    if (shareToggle && !isPremiumUser) {
        shareToggle.checked = false;
        locationSharingEnabled = false;
        localStorage.setItem('shareLocation', 'false');
    }
    
    // Profildeki premium badge
    if (premiumBadge) {
        premiumBadge.style.display = isPremiumUser ? 'inline-flex' : 'none';
    }
    
    // Konum toggle'ındaki kilitli durumu
    const toggleRow = document.querySelector('.pf-toggle-row');
    if (toggleRow) {
        toggleRow.classList.toggle('premium-feature-locked', !isPremiumUser);
    }
}

/**
 * Premium yükseltme modalını göster
 */
function showPremiumModal() {
    const modal = document.getElementById('premium-modal');
    if (modal) modal.style.display = 'flex';
}

window.closePremiumModal = function() {
    const modal = document.getElementById('premium-modal');
    if (modal) modal.style.display = 'none';
};

/**
 * Admin: Kullanıcının premium durumunu değiştir
 */
window.togglePremium = function(phone, makePremium) {
    if (!database) return;
    const msg = makePremium 
        ? `${phone} numarasını PREMIUM yapmak istiyor musunuz?`
        : `${phone} numarasının Premium üyeliğini KALDIRMAK istiyor musunuz?`;
    if (!confirm(msg)) return;
    
    database.ref('users/' + phone + '/premium').set(makePremium).then(() => {
        alert(makePremium ? `👑 ${phone} artık Premium üye!` : `${phone} Premium üyelikten çıkarıldı.`);
        if (typeof renderUsersTab === 'function') renderUsersTab();
    }).catch(e => alert('Hata: ' + e.message));
};

// Sayfa yüklendiğinde ve hemen şimdi premium kontrolü yap
if (localStorage.getItem('isLoggedIn') === 'true' && localStorage.getItem('userPhone')) {
    checkPremiumStatus();
}
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('isLoggedIn') === 'true' && localStorage.getItem('userPhone')) {
        checkPremiumStatus();
    }
});
