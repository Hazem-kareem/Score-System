// ==========================================
// account/reset.js (إعادة تعيين كلمة المرور)
// ==========================================

const API_BASE_URL = 'http://127.0.0.1:8000';
const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
    $('reset-form').addEventListener('submit', handleResetPassword);
});

function showAlert(contentHtml, type = 'danger') {
    const el = $('reset-alert');
    el.className = `alert alert-${type}`;
    el.innerHTML = contentHtml;
}

function hideAlert() {
    $('reset-alert').className = 'alert hidden';
}

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

async function handleResetPassword(e) {
    e.preventDefault();
    hideAlert();

    const newPassword = $('new-password').value;
    const confirmPassword = $('confirm-password').value;

    if (newPassword !== confirmPassword) {
        showAlert('كلمتا المرور غير متطابقتين.');
        return;
    }

    const token = getQueryParam('token') || getQueryParam('code');
    const uid = getQueryParam('uid');

    const btn = $('reset-submit');
    btn.disabled = true;
    showAlert('<i class="fa-solid fa-gear fa-spin gear-spinner"></i>', 'warning');

    try {
        const res = await fetch(`${API_BASE_URL}/api/reset-password/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: newPassword,
                token: token,
                uid: uid
            })
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
            showAlert('تم تغير كلمة المرور بنجاح! جاري تحويلك للوجن...', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showAlert(data.detail || data.error || 'تعذر إعادة تعيين كلمة المرور، قد يكون الرابط منتهي الصلاحية.');
        }
    } catch (err) {
        console.error('Reset password error:', err);
        showAlert('تعذر الاتصال بالسيرفر.');
    } finally {
        btn.disabled = false;
    }
}