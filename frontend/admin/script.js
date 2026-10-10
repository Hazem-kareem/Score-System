const API_BASE_URL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' 
    ? 'http://127.0.0.1:8000' 
    : '';
    
let teachersCache = [];
let subjectsCache = [];
let studentsCache = [];
let marksCache = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;

    buildPeriodOptions();
    document.getElementById('modal-period-select').addEventListener('change', togglePeriodInputs);
    document.getElementById('mark-form').addEventListener('submit', submitMark);
    document.getElementById('subject-form').addEventListener('submit', submitSubject);

    const allowed = await loadProfile();
    if (!allowed) return;

    await Promise.all([loadTeachersAndSubjects(), loadStudents()]);
    loadGrades();
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

function extractError(data, fallback = 'حدث خطأ غير متوقع، يرجى المحاولة لاحقاً.') {
    if (!data || typeof data !== 'object') return fallback;
    if (data.detail) return data.detail;

    const msg = Object.entries(data)
        .map(([field, v]) => `${field}: ${Array.isArray(v) ? v.join(' ') : v}`)
        .join(' | ');

    return msg || fallback;
}

const asList = (d) => (Array.isArray(d) ? d : (d?.results || d?.students || d?.teachers || []));

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
            if (!refresh) { logout(); return { ok: false, data: null }; }

            const r = await fetch(`${API_BASE_URL}/api/token-refresh/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh })
            });
            if (!r.ok) { logout(); return { ok: false, data: null }; }

            const rd = await r.json();
            localStorage.setItem('access_token', rd.access);
            if (rd.refresh) localStorage.setItem('refresh_token', rd.refresh);
            res = await fetch(`${API_BASE_URL}${endpoint}`, build(rd.access));
        }

        const data = res.status === 204 ? null : await res.json().catch(() => null);
        if (!res.ok) console.warn(`[${res.status}] ${endpoint}`, data);
        return { ok: res.ok, status: res.status, data };
    } catch (err) {
        console.error(`خطأ في ${endpoint}:`, err);
        return { ok: false, data: null };
    }
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
    }, 5000);
}

function closeModal(id) {
    document.getElementById(id)?.classList.add('hidden');
}

function confirmAction(msg, onAccept) {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-message').textContent = msg;
    modal.classList.remove('hidden');
    document.getElementById('confirm-btn-accept').onclick = async () => {
        modal.classList.add('hidden');
        await onAccept();
    };
    document.getElementById('confirm-btn-cancel').onclick = () => modal.classList.add('hidden');
}

// ---------- التبويبات ----------
function switchMainTab(tab) {
    document.querySelectorAll('.tab-content').forEach((el) => el.classList.add('hidden'));
    document.querySelectorAll('.sidebar-menu a').forEach((el) => el.classList.remove('active'));
    document.getElementById(`section-${tab}`)?.classList.remove('hidden');
    document.getElementById(`nav-${tab}`)?.classList.add('active');

    const titles = { teachers: 'المدرسين والمواد', grades: 'درجات الطلاب', profile: 'الحساب الشخصي' };
    document.getElementById('page-title').textContent = titles[tab] || '';
}

// ---------- تحميل عرض البروفايل ----------
async function loadProfile() {
    const { data } = await request('/api/user-info/');
    if (!data) return false;

    const role = String(data.role || '').toLowerCase();
    if (role && role !== 'admin' && !data.is_staff) {
        window.location.href = role === 'teacher' ? '../teacher/index.html' : '../student/index.html';
        return false;
    }

    const name = personName(data, 'المدير');
    const initial = name.charAt(0).toUpperCase();
    const set = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };

    set('sidebar-admin-name', name);
    set('user-display', name);
    set('user-initials', initial);
    set('profile-avatar-large', initial);
    set('profile-full-name-display', name);

    set('profile-username', data.username || '-');
    set('profile-first-name', data.first_name || '-');
    set('profile-last-name', data.last_name || '-');
    set('profile-email', data.email || '-');

    return true;
}

// ---------- المواد والمعلمين ----------
async function loadTeachersAndSubjects() {
    const tbody = document.getElementById('teachers-list-body');
    tbody.innerHTML = '<tr><td colspan="5">جاري التحميل...</td></tr>';

    const [subjRes, teachRes] = await Promise.all([request('/api/subjects/'), request('/api/teachers/')]);
    subjectsCache = subjRes.ok ? asList(subjRes.data) : [];
    teachersCache = teachRes.ok ? asList(teachRes.data) : [];

    if (!subjRes.ok) {
        tbody.innerHTML = '<tr><td colspan="5">تعذر تحميل المواد.</td></tr>';
        return;
    }
    renderSubjects();
}

function renderSubjects() {
    const tbody = document.getElementById('teachers-list-body');
    if (subjectsCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">لا توجد مواد مسجلة.</td></tr>';
        return;
    }

    tbody.innerHTML = subjectsCache.map((s, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${esc(s.subject_name || s.name)}</strong></td>
            <td>${esc(personName(s.teacher, 'غير مسند'))}</td>
            <td>${esc(s.teacher?.email || '-')}</td>
            <td>
                <button class="btn btn-sm btn-edit" onclick="openEditSubjectModal(${s.id})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm btn-delete" onclick="deleteSubject(${s.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`).join('');
}

function fillTeacherSelect(selectedId = null) {
    const sel = document.getElementById('select-teacher');
    sel.innerHTML = '<option value="">اختر المعلم...</option>' +
        teachersCache.map((t) => `<option value="${t.id}">${esc(personName(t))}</option>`).join('');
    sel.value = selectedId ?? '';
}

function openAddSubjectModal() {
    document.getElementById('subject-modal-title').textContent = 'إضافة مادة';
    document.getElementById('subject-form').reset();
    document.getElementById('subject-id').value = '';
    fillTeacherSelect();
    document.getElementById('subject-modal').classList.remove('hidden');
}

function openEditSubjectModal(id) {
    const s = subjectsCache.find((x) => x.id === id);
    if (!s) return;
    document.getElementById('subject-modal-title').textContent = 'تعديل المادة';
    document.getElementById('subject-id').value = s.id;
    document.getElementById('input-subject-name').value = s.subject_name || s.name || '';
    fillTeacherSelect(s.teacher?.id ?? s.teacher);
    document.getElementById('subject-modal').classList.remove('hidden');
}

async function submitSubject(e) {
    e.preventDefault();
    const id = document.getElementById('subject-id').value;
    const name = document.getElementById('input-subject-name').value.trim();
    const teacher = document.getElementById('select-teacher').value;

    const payload = {
        subject_name: name,
        name: name,
        teacher: teacher ? Number(teacher) : null
    };

    const { ok, data } = await request(id ? `/api/subjects/${id}/` : '/api/subjects/', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
    });

    if (ok) {
        closeModal('subject-modal');
        showToast(id ? 'تم تعديل المادة.' : 'تمت إضافة المادة بنجاح.');
        loadTeachersAndSubjects();
    } else {
        showToast(extractError(data, 'تعذر حفظ بيانات المادة.'), 'error');
    }
}

function deleteSubject(id) {
    confirmAction('هل أنت متأكد من حذف هذه المادة؟', async () => {
        const { ok, data } = await request(`/api/subjects/${id}/`, { method: 'DELETE' });
        if (ok) {
            showToast('تم حذف المادة.');
            loadTeachersAndSubjects();
        } else {
            showToast(extractError(data, 'تعذر حذف المادة.'), 'error');
        }
    });
}

// ---------- الطلاب والدرجات ----------
async function loadStudents() {
    const { ok, data } = await request('/api/students/');
    if (ok) studentsCache = asList(data);
}

async function loadGrades() {
    const tbody = document.getElementById('all-marks-body');
    tbody.innerHTML = '<tr><td colspan="8">جاري التحميل...</td></tr>';

    const { ok, data } = await request('/api/marks/');
    if (!ok) {
        tbody.innerHTML = '<tr><td colspan="8">تعذر تحميل الدرجات.</td></tr>';
        return;
    }
    marksCache = asList(data);
    renderGrades();
}

function renderGrades() {
    const tbody = document.getElementById('all-marks-body');
    if (marksCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">لا توجد درجات مرصودة.</td></tr>';
        return;
    }

    tbody.innerHTML = marksCache.map((m) => {
        const monthly = String(m.period).startsWith('month_');
        return `
            <tr>
                <td><strong>${esc(personName(m.student))}</strong></td>
                <td>${esc(m.subject?.subject_name || m.subject?.name || '-')}</td>
                <td>${esc(m.period_display || m.period || '-')}</td>
                <td>${monthly ? '-' : esc(m.class_work ?? 0)}</td>
                <td>${monthly ? '-' : esc(m.homework ?? 0)}</td>
                <td>${monthly ? '-' : esc(m.weekly_assessment ?? 0)}</td>
                <td><strong>${esc(monthly ? (m.monthly_exam ?? m.score ?? 0) : (m.score ?? 0))}</strong></td>
                <td>
                    <button class="btn btn-sm btn-edit" onclick="openEditMarkModal(${m.id})"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-sm btn-delete" onclick="deleteMark(${m.id})"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
    }).join('');
}

function buildPeriodOptions() {
    let html = '';
    for (let i = 1; i <= 16; i++) html += `<option value="week_${i}">الأسبوع ${i}</option>`;
    html += '<option value="month_1_exam">امتحان الشهر الأول</option>';
    html += '<option value="month_2_exam">امتحان الشهر الثاني</option>';
    document.getElementById('modal-period-select').innerHTML = html;
}

function togglePeriodInputs() {
    const monthly = document.getElementById('modal-period-select').value.startsWith('month_');
    document.getElementById('group-weekly-inputs').classList.toggle('hidden', monthly);
    document.getElementById('group-monthly-input').classList.toggle('hidden', !monthly);
}

function fillMarkSelects(selStudent = null, selSubject = null) {
    const st = document.getElementById('modal-student-select');
    const sb = document.getElementById('modal-subject-select');

    st.innerHTML = '<option value="">اختر الطالب...</option>' +
        studentsCache.map((s) => `<option value="${s.id}">${esc(personName(s))}</option>`).join('');
    sb.innerHTML = '<option value="">اختر المادة...</option>' +
        subjectsCache.map((s) => `<option value="${s.id}">${esc(s.subject_name || s.name)}</option>`).join('');

    st.value = selStudent ?? '';
    sb.value = selSubject ?? '';
}

function openAddMarkModal() {
    document.getElementById('mark-modal-title').textContent = 'رصد درجة جديدة';
    document.getElementById('mark-form').reset();
    document.getElementById('mark-id').value = '';
    fillMarkSelects();
    togglePeriodInputs();
    document.getElementById('mark-modal').classList.remove('hidden');
}

function openEditMarkModal(id) {
    const m = marksCache.find((x) => x.id === id);
    if (!m) return;

    document.getElementById('mark-modal-title').textContent = 'تعديل الدرجة';
    document.getElementById('mark-id').value = m.id;
    fillMarkSelects(m.student?.id ?? m.student, m.subject?.id ?? m.subject);
    document.getElementById('modal-period-select').value = m.period;
    document.getElementById('input-class-work').value = m.class_work ?? '';
    document.getElementById('input-homework').value = m.homework ?? '';
    document.getElementById('input-weekly-assessment').value = m.weekly_assessment ?? '';
    document.getElementById('input-monthly-exam').value = m.monthly_exam ?? '';
    togglePeriodInputs();
    document.getElementById('mark-modal').classList.remove('hidden');
}

const numOrNull = (id) => {
    const v = document.getElementById(id).value;
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
        closeModal('mark-modal');
        showToast(id ? 'تم تعديل الدرجة.' : 'تم رصد الدرجة بنجاح.');
        loadGrades();
    } else {
        showToast(extractError(data, 'تعذر حفظ الدرجة.'), 'error');
    }
}

function deleteMark(id) {
    confirmAction('هل أنت متأكد من حذف هذه الدرجة؟', async () => {
        const { ok, data } = await request(`/api/marks/${id}/`, { method: 'DELETE' });
        if (ok) {
            showToast('تم حذف الدرجة.');
            loadGrades();
        } else {
            showToast(extractError(data, 'تعذر حذف الدرجة.'), 'error');
        }
    });
}

// ---------- الخروج ----------
function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '../account/login.html';
}