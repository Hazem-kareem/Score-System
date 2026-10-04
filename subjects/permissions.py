from rest_framework import permissions

class IsTeacherOrAdmin(permissions.BasePermission):
    """
    صلاحية تعطي الوصول الكامل للأدمن وللمدرسين فقط
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['Teacher', 'Admin']
        )