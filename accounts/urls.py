from django.urls import include, path
from .views import *
from rest_framework_simplejwt.views import TokenRefreshView, TokenBlacklistView

urlpatterns = [
    path('token-refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', TokenBlacklistView.as_view(), name = 'log_out'),
    path('forget-password/', ForgetPasswordView.as_view(), name='forget-password'),
    path('register/', Register, name='register'),
    path('login/', Login, name='Login'),
    path('user-info/', user_info, name='user_info'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),
    path('students/', get_students, name='students_list'),
    path('teachers/', get_teachers, name='teachers_list'),
]


