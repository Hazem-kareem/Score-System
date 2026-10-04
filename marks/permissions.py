from rest_framework import permissions
from subjects.models import Subject

class IsTeacherOrAdminForWrite(permissions.BasePermission):

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in permissions.SAFE_METHODS:
            return True

        user_role = getattr(request.user, 'role', None)
        return request.user.is_staff or user_role in ['Teacher', 'Admin']

class IsMarkSubjectTeacherOrAdmin(permissions.BasePermission):

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # الأدمن والـ Staff لديهم كامل الصلاحيات
        if request.user.is_staff or getattr(request.user, 'role', None) == "Admin":
            return True

        # في حالة الإنشاء POST: نتحقق أن المدرس يملك المادة المبعوثة في الـ Body
        if request.method == 'POST':
            subject_id = request.data.get('subject')
            if subject_id:
                try:
                    subject = Subject.objects.get(pk=subject_id)
                    return subject.teacher == request.user
                except Subject.DoesNotExist:
                    return False
            return False

        return True

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff or getattr(request.user, 'role', None) == "Admin":
            return True

        if request.method in permissions.SAFE_METHODS:
            return obj.student == request.user or obj.subject.teacher == request.user

        return obj.subject.teacher == request.user