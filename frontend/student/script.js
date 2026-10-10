const API_BASE_URL = 'http://127.0.0.1:8000';

document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;
    
    // التتابع لتفادي تجديد التوكين في نفس اللحظة
    await loadProfile();
    await loadGrades();
    await loadSubjects();
});
 
// ---------- أدوات ----------
function checkAuth() {
    if (!localStorage.getItem('access_token')) {
        window.location.href = '../account/login.html';
        return false;
    }
    return true;
}
 
function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
 
function personName(p, fallback) {
    if (!p) return fallback;
    if (typeof p !== 'object') return p;
    const full = `${p.first_name || ''} ${p.last_name || ''}`.trim();
    return full || p.username || fallback;
}
 
async function fetchAPI(endpoint, options = {}) {
    const buildConfig = (token) => ({
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers
        }
    });
 
    try {
        let response = await fetch(`${API_BASE_URL}${endpoint}`, buildConfig(localStorage.getItem('access_token')));
 
        if (response.status === 401) {
            const refreshToken = localStorage.getItem('refresh_token');
            if (!refreshToken) { logout(); return null; }
 
            const refreshRes = await fetch(`${API_BASE_URL}/api/token-refresh/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh: refreshToken })
            });
 
            if (!refreshRes.ok) { logout(); return null; }
 
            const refreshData = await refreshRes.json();
            localStorage.setItem('access_token', refreshData.access);
            if (refreshData.refresh) localStorage.setItem('refresh_token', refreshData.refresh);
 
            response = await fetch(`${API_BASE_URL}${endpoint}`, buildConfig(refreshData.access));
        }
 
        if (!response.ok) throw new Error(`خطأ في السيرفر: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`خطأ أثناء طلب البيانات من ${endpoint}:`, error);
        return null;
    }
}
 
// ---------- التبويبات ----------
function switchMainTab(tabName) {
    document.querySelectorAll('.tab-content').forEach((el) => el.classList.add('hidden'));
    document.querySelectorAll('.sidebar-menu a').forEach((el) => el.classList.remove('active'));
 
    document.getElementById(`section-${tabName}`)?.classList.remove('hidden');
    document.getElementById(`nav-${tabName}`)?.classList.add('active');
 
    const titles = { grades: 'الدرجات', teachers: 'المدرسين والمواد', account: 'الحساب الشخصي' };
    if (titles[tabName]) document.getElementById('page-title').textContent = titles[tabName];
}
 
function switchGradesSubTab(subTab) {
    document.querySelectorAll('.grades-sub-view').forEach((el) => el.classList.add('hidden'));
    document.querySelectorAll('.subnav-btn').forEach((el) => el.classList.remove('active'));
 
    document.getElementById(`grades-${subTab}-view`)?.classList.remove('hidden');
    document.getElementById(`subnav-${subTab}`)?.classList.add('active');
}
 
// ---------- البروفايل ----------
async function loadProfile() {
    const data = await fetchAPI('/api/user-info/');
    if (!data) return;
 
    const fullName = personName(data, 'طالب');
    const initial = fullName.charAt(0).toUpperCase();
 
    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
 
    setText('sidebar-student-name', fullName);
    setText('user-display', fullName);
    setText('user-initials', initial);
    setText('profile-avatar', initial);
    setText('profile-username', fullName);
    setText('profile-email', data.email || 'لا يوجد بريد إلكتروني');
}
 
// ---------- الدرجات ----------
async function loadGrades() {
    const weeklyTbody = document.getElementById('weekly-marks-body');
    const monthlyTbody = document.getElementById('monthly-marks-body');
 
    if(weeklyTbody) weeklyTbody.innerHTML = '<tr><td colspan="7">جاري التحميل...</td></tr>';
    if(monthlyTbody) monthlyTbody.innerHTML = '<tr><td colspan="4">جاري التحميل...</td></tr>';
 
    const data = await fetchAPI('/api/marks/');
 
    if (data === null) {
        if(weeklyTbody) weeklyTbody.innerHTML = '<tr><td colspan="7">تعذر تحميل الدرجات، تحقق من اتصال السيرفر.</td></tr>';
        if(monthlyTbody) monthlyTbody.innerHTML = '<tr><td colspan="4">تعذر تحميل الدرجات، تحقق من اتصال السيرفر.</td></tr>';
        return;
    }
 
    const marks = Array.isArray(data) ? data : (data.results || []);
 
    let weeklyHtml = '';
    let monthlyHtml = '';
 
    marks.forEach((item) => {
        const subj = item.subject;
        const subjectName = (subj && typeof subj === 'object')
            ? (subj.subject_name || subj.name || 'غير محدد')
            : (item.subject_name || subj || 'غير محدد');
 
        const teacherName = (subj && typeof subj === 'object' && subj.teacher)
            ? personName(subj.teacher, 'غير مسند')
            : (item.teacher_name || 'غير مسند');
 
        const period = item.period || '';
        const periodDisplay = item.period_display || period || '-';
 
        if (String(period).startsWith('month_')) {
            monthlyHtml += `
                <tr>
                    <td><strong>${esc(teacherName)}</strong></td>
                    <td>${esc(subjectName)}</td>
                    <td>${esc(periodDisplay)}</td>
                    <td><strong style="color: var(--accent);">${esc(item.monthly_exam ?? item.score ?? 0)}</strong></td>
                </tr>`;
        } else {
            weeklyHtml += `
                <tr>
                    <td><strong>${esc(teacherName)}</strong></td>
                    <td>${esc(subjectName)}</td>
                    <td>${esc(periodDisplay)}</td>
                    <td>${esc(item.class_work ?? 0)}</td>
                    <td>${esc(item.homework ?? 0)}</td>
                    <td>${esc(item.weekly_assessment ?? 0)}</td>
                    <td><span class="total-score-badge">${esc(item.score ?? 0)}</span></td>
                </tr>`;
        }
    });
 
    if(weeklyTbody) weeklyTbody.innerHTML = weeklyHtml || '<tr><td colspan="7">لا توجد تقييمات أسبوعية مسجلة حالياً.</td></tr>';
    if(monthlyTbody) monthlyTbody.innerHTML = monthlyHtml || '<tr><td colspan="4">لا توجد امتحانات شهرية مسجلة حالياً.</td></tr>';
}
 
// ---------- المدرسين والمواد ----------
async function loadSubjects() {
    const tbody = document.getElementById('teachers-body');
    if(!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4">جاري التحميل...</td></tr>';
 
    const data = await fetchAPI('/api/subjects/');
 
    if (data === null) {
        tbody.innerHTML = '<tr><td colspan="4">تعذر تحميل المواد، تحقق من اتصال السيرفر.</td></tr>';
        return;
    }
 
    const subjects = Array.isArray(data) ? data : (data.results || []);
 
    if (subjects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">لا يوجد مدرسين مسجلين حالياً.</td></tr>';
        return;
    }
 
    tbody.innerHTML = subjects.map((item, index) => {
        const t = item.teacher;
        const teacherName = (t && typeof t === 'object') ? personName(t, 'غير مسند') : (item.teacher_name || t || 'غير مسند');
        const teacherEmail = (t && typeof t === 'object' && t.email) ? t.email : 'لا يوجد بريد';
 
        return `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${esc(item.subject_name || item.name || '-')}</strong></td>
                <td>${esc(teacherName)}</td>
                <td>${esc(teacherEmail)}</td>
            </tr>`;
    }).join('');
}
 
// ---------- الخروج ----------
function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '../account/login.html';
}