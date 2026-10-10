const API_BASE_URL = 'http://127.0.0.1:8000';
const STUDENTS_ENDPOINT = '/api/students/';

let currentUser = null;
let allMarks = [];
let studentsCache = [];
let subjectsCache = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;

    document.getElementById('modal-period-select').addEventListener('change', togglePeriodInputs);
    document.getElementById('mark-form').addEventListener('submit', submitMark);
 
    // تنفيذ الطلبات بالتتابع لمنع الـ Race Condition
    await loadProfile();
    await loadMarks();
    await loadStudents();
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
 
function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
 
function personName(p, fallback = '-') {
    if (!p) return fallback;
    if (typeof p !== 'object') return p;
    return `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username || fallback;
}
 
function extractError(data) {
    if (!data || typeof data !== 'object') return 'حدث خطأ غير متوقع.';
    if (data.detail) return data.detail;
    const msg = Object.values(data)
        .map((v) => (Array.isArray(v) ? v.join(' ') : (typeof v === 'string' ? v : '')))
        .filter(Boolean)
        .join(' | ');
    return msg || 'حدث خطأ غير متوقع.';
}
 
function showToast(message, type = 'success') {
    const box = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i><span>${esc(message)}</span>`;
    box.appendChild(el);
    setTimeout(() => {
        el.classList.add('fade-out');
        setTimeout(() => el.remove(), 300);
    }, 3500);
}
 
// طلب عام مع تجديد التوكين
async function request(endpoint, options = {}) {
    const build = (token) => ({
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers
        }
    });
 
    try {
        let res = await fetch(`${API_BASE_URL}${endpoint}`, build(localStorage.getItem('access_token')));
 
        if (res.status === 401) {
            const refresh = localStorage.getItem('refresh_token');
            if (!refresh) { logout(); return { ok: false, status: 401, data: null }; }
 
            const r = await fetch(`${API_BASE_URL}/api/token-refresh/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh })
            });
            
            if (!r.ok) { logout(); return { ok: false, status: 401, data: null }; }
 
            const rd = await r.json();
            localStorage.setItem('access_token', rd.access);
            if (rd.refresh) localStorage.setItem('refresh_token', rd.refresh);
            
            res = await fetch(`${API_BASE_URL}${endpoint}`, build(rd.access));
        }
 
        const data = res.status === 204 ? null : await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, data };
    } catch (err) {
        console.error(`خطأ في ${endpoint}:`, err);
        return { ok: false, status: 0, data: null };
    }
}
 
const asList = (data) => (Array.isArray(data) ? data : (data?.results || data?.students || []));
 
// ---------- التبويبات ----------
function switchMainTab(tab) {
    document.querySelectorAll('.tab-content').forEach((el) => el.classList.add('hidden'));
    document.querySelectorAll('.sidebar-menu a').forEach((el) => el.classList.remove('active'));
    document.getElementById(`section-${tab}`)?.classList.remove('hidden');
    document.getElementById(`nav-${tab}`)?.classList.add('active');
 
    const titles = { grades: 'الدرجات', students: 'الطلاب', account: 'الحساب الشخصي' };
    document.getElementById('page-title').textContent = titles[tab] || '';
}
 
function switchGradesSubTab(sub) {
    document.querySelectorAll('.grades-sub-view').forEach((el) => el.classList.add('hidden'));
    document.querySelectorAll('.subnav-btn').forEach((el) => el.classList.remove('active'));
    document.getElementById(`grades-${sub}-view`)?.classList.remove('hidden');
    document.getElementById(`subnav-${sub}`)?.classList.add('active');
}
 
// ---------- البروفايل ----------
async function loadProfile() {
    const { data } = await request('/api/user-info/');
    if (!data) return;
    currentUser = data;
 
    const name = personName(data, 'المعلم');
    const set = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
 
    set('sidebar-teacher-name', name);
    set('user-display', name);
    set('user-initials', name.charAt(0).toUpperCase());
    set('profile-avatar', name.charAt(0).toUpperCase());
    set('profile-username', name);
    set('profile-email', data.email || 'لا يوجد بريد إلكتروني');
    set('profile-role', `الصلاحية: ${data.role || 'Teacher'}`);
}
 
// ---------- الدرجات ----------
async function loadMarks() {
    const weeklyBody = document.getElementById('weekly-marks-body');
    const monthlyBody = document.getElementById('monthly-marks-body');
    if(weeklyBody) weeklyBody.innerHTML = '<tr><td colspan="8">جاري التحميل...</td></tr>';
    if(monthlyBody) monthlyBody.innerHTML = '<tr><td colspan="5">جاري التحميل...</td></tr>';
 
    const { ok, data } = await request('/api/marks/');
 
    if (!ok) {
        if(weeklyBody) weeklyBody.innerHTML = '<tr><td colspan="8">تعذر تحميل الدرجات، تحقق من اتصال السيرفر.</td></tr>';
        if(monthlyBody) monthlyBody.innerHTML = '<tr><td colspan="5">تعذر تحميل الدرجات، تحقق من اتصال السيرفر.</td></tr>';
        return;
    }
 
    allMarks = asList(data);
    renderMarks();
}
 
function actionButtons(id) {
    return `
        <button class="btn btn-sm btn-edit" onclick="openEditMarkModal(${id})"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-sm btn-delete" onclick="deleteMark(${id})"><i class="fa-solid fa-trash"></i></button>`;
}
 
function renderMarks() {
    let weekly = '';
    let monthly = '';
 
    allMarks.forEach((m) => {
        const student = esc(personName(m.student));
        const subject = esc(m.subject?.subject_name || m.subject?.name || m.subject_name || '-');
        const period = esc(m.period_display || m.period || '-');
 
        if (String(m.period).startsWith('month_')) {
            monthly += `
                <tr>
                    <td>${student}</td><td>${subject}</td><td>${period}</td>
                    <td><strong>${esc(m.monthly_exam ?? m.score ?? 0)}</strong></td>
                    <td>${actionButtons(m.id)}</td>
                </tr>`;
        } else {
            weekly += `
                <tr>
                    <td>${student}</td><td>${subject}</td><td>${period}</td>
                    <td>${esc(m.class_work ?? 0)}</td>
                    <td>${esc(m.homework ?? 0)}</td>
                    <td>${esc(m.weekly_assessment ?? 0)}</td>
                    <td><strong>${esc(m.score ?? 0)}</strong></td>
                    <td>${actionButtons(m.id)}</td>
                </tr>`;
        }
    });
 
    const weeklyBody = document.getElementById('weekly-marks-body');
    const monthlyBody = document.getElementById('monthly-marks-body');

    if(weeklyBody) weeklyBody.innerHTML = weekly || '<tr><td colspan="8">لا توجد تقييمات أسبوعية مرصودة حالياً.</td></tr>';
    if(monthlyBody) monthlyBody.innerHTML = monthly || '<tr><td colspan="5">لا توجد امتحانات شهرية مرصودة حالياً.</td></tr>';
 
    if (studentsCache.length === 0) {
        buildStudentsFromMarks();
        renderStudents();
    }
}
 
// ---------- الطلاب ----------
async function loadStudents() {
    const { ok, data } = await request(STUDENTS_ENDPOINT);
    if (ok) studentsCache = asList(data);
    else buildStudentsFromMarks();
    renderStudents();
}
 
function buildStudentsFromMarks() {
    const map = new Map();
    allMarks.forEach((m) => {
        if (m.student && typeof m.student === 'object') map.set(m.student.id, m.student);
    });
    studentsCache = [...map.values()];
}
 
function renderStudents() {
    const tbody = document.getElementById('students-list-body');
    if (!tbody) return;

    if (studentsCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">لا يوجد طلاب لعرضهم حالياً.</td></tr>';
        return;
    }
    tbody.innerHTML = studentsCache.map((s, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${esc(personName(s))}</td>
            <td>${esc(s.username)}</td>
            <td>${esc(s.email || '-')}</td>
            <td><button class="btn btn-sm btn-edit" onclick="openAddMarkModal(${s.id})"><i class="fa-solid fa-plus"></i> رصد درجة</button></td>
        </tr>`).join('');
}
 
// ---------- المواد ----------
async function loadSubjects() {
    const { data } = await request('/api/subjects/');
    let list = asList(data);
    if (currentUser?.id) {
        list = list.filter((s) => (s.teacher?.id ?? s.teacher) === currentUser.id);
    }
    subjectsCache = list;
}
 
// ---------- نافذة الرصد ----------
function fillSelects(selectedStudent, selectedSubject) {
    const studentSel = document.getElementById('modal-student-select');
    const subjectSel = document.getElementById('modal-subject-select');
 
    if(studentSel) {
        studentSel.innerHTML = '<option value="">اختر الطالب...</option>' +
            studentsCache.map((s) => `<option value="${s.id}">${esc(personName(s))}</option>`).join('');
        studentSel.value = selectedStudent ?? '';
    }

    if(subjectSel) {
        subjectSel.innerHTML = '<option value="">اختر المادة...</option>' +
            subjectsCache.map((s) => `<option value="${s.id}">${esc(s.subject_name || s.name)}</option>`).join('');
        subjectSel.value = selectedSubject ?? '';
    }
}
 
function togglePeriodInputs() {
    const isMonthly = document.getElementById('modal-period-select').value.startsWith('month_');
    document.getElementById('group-weekly-inputs')?.classList.toggle('hidden', isMonthly);
    document.getElementById('group-monthly-input')?.classList.toggle('hidden', !isMonthly);
}
 
function openAddMarkModal(studentId = null) {
    document.getElementById('modal-title').textContent = 'رصد درجة جديدة';
    document.getElementById('mark-form').reset();
    document.getElementById('mark-id').value = '';
    fillSelects(studentId, subjectsCache.length === 1 ? subjectsCache[0].id : null);
    togglePeriodInputs();
    document.getElementById('mark-modal').classList.remove('hidden');
}
 
function openEditMarkModal(id) {
    const m = allMarks.find((x) => x.id === id);
    if (!m) return;
 
    document.getElementById('modal-title').textContent = 'تعديل الدرجة';
    document.getElementById('mark-id').value = m.id;
    fillSelects(m.student?.id ?? m.student, m.subject?.id ?? m.subject);
    document.getElementById('modal-period-select').value = m.period;
    
    document.getElementById('input-class-work').value = m.class_work ?? '';
    document.getElementById('input-homework').value = m.homework ?? '';
    document.getElementById('input-weekly-assessment').value = m.weekly_assessment ?? '';
    document.getElementById('input-monthly-exam').value = m.monthly_exam ?? '';
    
    togglePeriodInputs();
    document.getElementById('mark-modal').classList.remove('hidden');
}
 
function closeMarkModal() {
    document.getElementById('mark-modal').classList.add('hidden');
}
 
const numOrNull = (id) => {
    const el = document.getElementById(id);
    if(!el) return null;
    const v = el.value;
    return v === '' ? null : Number(v);
};
 
async function submitMark(e) {
    e.preventDefault();
 
    const id = document.getElementById('mark-id').value;
    const period = document.getElementById('modal-period-select').value;
 
    const payload = {
        student: Number(document.getElementById('modal-student-select').value),
        subject: Number(document.getElementById('modal-subject-select').value),
        period
    };
 
    if (period.startsWith('month_')) {
        payload.monthly_exam = numOrNull('input-monthly-exam');
    } else {
        payload.class_work = numOrNull('input-class-work');
        payload.homework = numOrNull('input-homework');
        payload.weekly_assessment = numOrNull('input-weekly-assessment');
    }
 
    const { ok, data } = await request(id ? `/api/marks/${id}/` : '/api/marks/', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
    });
 
    if (ok) {
        closeMarkModal();
        showToast(id ? 'تم تعديل الدرجة بنجاح.' : 'تم رصد الدرجة بنجاح.');
        await loadMarks();
    } else {
        showToast(extractError(data), 'error');
    }
}
 
// ---------- الحذف ----------
function deleteMark(id) {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-message').textContent = 'هل أنت متأكد من حذف هذه الدرجة؟';
    modal.classList.remove('hidden');
 
    const accept = document.getElementById('confirm-btn-accept');
    const cancel = document.getElementById('confirm-btn-cancel');
    const close = () => modal.classList.add('hidden');
 
    cancel.onclick = close;
    accept.onclick = async () => {
        close();
        const { ok, data } = await request(`/api/marks/${id}/`, { method: 'DELETE' });
        if (ok) {
            showToast('تم حذف الدرجة.');
            await loadMarks();
        } else {
            showToast(extractError(data), 'error');
        }
    };
}
 
// ---------- الخروج ----------
function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '../account/login.html';
}