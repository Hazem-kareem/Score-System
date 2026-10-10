// ==========================================
// account/script.js  (تسجيل الدخول / إنشاء حساب / نسيت كلمة المرور)
// ==========================================

const API_BASE_URL = 'http://127.0.0.1:8000';
const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
    $('login-form').addEventListener('submit', handleLogin);$('register-form').addEventListener('submit', handleRegister);
    $('toggle-btn').addEventListener('click', toggleMode);$('forgot-email').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitForgotPassword();
    });
});

// ---------- أدوات مساعدة ----------
function showAlert(contentHtml, type = 'danger') {
    const el = $('auth-alert');
    el.className = `alert alert-${type}`;
    el.innerHTML = contentHtml;
}

function hideAlert() {
    $('auth-alert').className = 'alert hidden';
}

function extractError(data) {
    if (!data || typeof data !== 'object') return '';
    if (data.detail) return data.detail;
    return Object.values(data)
        .map((v) => (Array.isArray(v) ? v.join(' ') : (typeof v === 'string' ? v : '')))
        .filter(Boolean)
        .join(' | ');
}

async function postJSON(path, body) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
}

// ---------- التبديل بين الدخول والتسجيل ----------
let isLoginMode = true;

function toggleMode() {
    isLoginMode = !isLoginMode;
    hideAlert();
    $('login-form').classList.toggle('hidden', !isLoginMode);
    $('register-form').classList.toggle('hidden', isLoginMode);$('form-title').textContent = isLoginMode ? 'تسجيل الدخول' : 'إنشاء حساب جديد';
    $('form-sub').textContent = isLoginMode
        ? 'سجّل الدخول للوصول إلى لوحتك الخاصة'
        : 'أدخل بياناتك لإنشاء حساب جديد';
    $('toggle-text').textContent = isLoginMode ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟';
    $('toggle-btn').textContent = isLoginMode ? 'تسجيل حساب جديد' : 'تسجيل الدخول';
}

// ---------- تسجيل الدخول ----------
async function handleLogin(e) {
    e.preventDefault();
    hideAlert();

    const username = $('login-username').value.trim();
    const password = $('login-password').value;
    const btn = $('login-submit');
    
    btn.disabled = true;
    showAlert('<i class="fa-solid fa-gear fa-spin gear-spinner"></i>', 'warning');

    try {
        const { res, data } = await postJSON('/api/login/', { username, password });

        if (!res.ok) {
            showAlert(extractError(data) || 'اسم المستخدم أو كلمة المرور غير صحيحة.');
            return;
        }

        const access = data.access || data.tokens?.access || data.token;
        const refresh = data.refresh || data.tokens?.refresh;

        if (!access) {
            showAlert('الباك اند لم يُرجع access token.');
            return;
        }

        localStorage.setItem('access_token', access);
        if (refresh) localStorage.setItem('refresh_token', refresh);

        let role = data.role || data.user?.role || (data.is_teacher ? 'Teacher' : null);
        if (!role) {
            try {
                const infoRes = await fetch(`${API_BASE_URL}/api/user-info/`, {
                    headers: { Authorization: `Bearer ${access}` }
                });
                if (infoRes.ok) {
                    const info = await infoRes.json();
                    role = info.role || (info.is_staff ? 'Admin' : null);
                }
            } catch (_) {}
        }

        redirectByRole(role);
    } catch (err) {
        console.error('Login error:', err);
        showAlert('تعذر الاتصال بالسيرفر. تأكد من تشغيل Django وإعدادات CORS.');
    } finally {
        btn.disabled = false;
    }
}

function redirectByRole(role) {
    const r = String(role || '').toLowerCase();
    if (r === 'admin') window.location.href = '../admin/index.html';
    else if (r === 'teacher') window.location.href = '../teacher/index.html';
    else window.location.href = '../student/index.html';
}

// ---------- إنشاء حساب ----------
async function handleRegister(e) {
    e.preventDefault();
    hideAlert();

    const payload = {
        username: $('reg-username').value.trim(),
        email: $('reg-email').value.trim(),
        first_name: $('reg-first-name').value.trim(),
        last_name: $('reg-last-name').value.trim(),
        password: $('reg-password').value
    };

    const btn = $('register-submit');
    btn.disabled = true;
    showAlert('<i class="fa-solid fa-gear fa-spin gear-spinner"></i>', 'warning');

    try {
        const { res, data } = await postJSON('/api/register/', payload);

        if (res.ok) {
            $('register-form').reset();
            toggleMode();
            showAlert('تم إنشاء الحساب بنجاح، سجّل الدخول الآن.', 'success');
        } else {
            showAlert(extractError(data) || 'تعذر إنشاء الحساب، راجع البيانات.');
        }
    } catch (err) {
        console.error('Register error:', err);
        showAlert('تعذر الاتصال بالسيرفر.');
    } finally {
        btn.disabled = false;
    }
}

// ---------- نسيت كلمة المرور ----------
function openForgotModal() {
    $('forgot-modal').classList.remove('hidden');$('forgot-email').focus();
}

function closeForgotModal() {
    $('forgot-modal').classList.add('hidden');
    $('forgot-msg').innerHTML = '';$('forgot-email').value = '';
}

async function submitForgotPassword() {
    const msgEl = $('forgot-msg');
    const email = $('forgot-email').value.trim();

    if (!email) {
        msgEl.style.color = 'var(--danger)';
        msgEl.textContent = 'يرجى كتابة البريد الإلكتروني.';
        return;
    }

    const btn = $('forgot-submit');
    btn.disabled = true;
    msgEl.innerHTML = '<i class="fa-solid fa-gear fa-spin gear-spinner"></i>';

    try {
        const { res, data } = await postJSON('/api/forget-password/', { email });

        if (res.ok) {
            msgEl.style.color = 'var(--success)';
            msgEl.textContent = 'تم إرسال تعليمات إعادة التعيين إلى بريدك.';
            setTimeout(closeForgotModal, 3000);
        } else {
            msgEl.style.color = 'var(--danger)';
            msgEl.textContent = extractError(data) || 'حدث خطأ، تأكد من صحة البريد الإلكتروني.';
        }
    } catch (err) {
        msgEl.style.color = 'var(--danger)';
        msgEl.textContent = 'تعذر الاتصال بالسيرفر.';
    } finally {
        btn.disabled = false;
    }
}