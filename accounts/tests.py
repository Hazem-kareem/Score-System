from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class AccountsAPITestCase(APITestCase):

    def setUp(self):
        # استخدام أسماء المسارات الصحيحة كما هي في urls.py
        self.register_url = reverse('register')
        self.login_url = reverse('Login')
        self.user_info_url = reverse('user_info')

        self.user_data = {
            'username': 'hazem',
            'first_name': 'Hazem',
            'last_name': 'Karim',
            'email': 'hazem@example.com',
            'password': 'Password123!',
            'role': 'student'
        }

        # إنشاء مستخدم تجريبي للاختبارات
        self.user = User.objects.create_user(
            username='testuser',
            first_name='Test',
            last_name='User',
            email='test@example.com',
            password='TestPassword123!',
            role='student'
        )

    # --- 1. اختبارات التسجيل (Register) ---
    def test_register_user_success(self):
        """تأكيد نجاح إنشاء حساب جديد ببيانات صحيحة"""
        response = self.client.post(self.register_url, self.user_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='hazem').exists())

    def test_register_user_missing_data(self):
        """تأكيد فشل التسجيل عند نقص بيانات إجبارية"""
        invalid_data = self.user_data.copy()
        invalid_data.pop('password')
        response = self.client.post(self.register_url, invalid_data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # --- 2. اختبارات تسجيل الدخول (Login) ---
    def test_login_success(self):
        """تأكيد نجاح تسجيل الدخول بالبيانات الصحيحة ورجوع الـ Tokens"""
        login_data = {
            'username': 'testuser',
            'password': 'TestPassword123!'
        }
        response = self.client.post(self.login_url, login_data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login_invalid_credentials(self):
        """تأكيد رفض تسجيل الدخول بكلمة مرور خاطئة"""
        login_data = {
            'username': 'testuser',
            'password': 'WrongPassword!'
        }
        response = self.client.post(self.login_url, login_data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # --- 3. اختبارات معلومات المستخدم (User Info) ---
    def test_authenticated_user_can_get_info(self):
        """تأكيد وصول المستخدم المسجل لبياناته المحددة في السيريالايزر"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.user_info_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], self.user.email)
        self.assertEqual(response.data['first_name'], self.user.first_name)
        self.assertEqual(response.data['last_name'], self.user.last_name)
        self.assertEqual(response.data['role'], self.user.role)

    def test_unauthenticated_user_cannot_get_info(self):
        """تأكيد منع الزائر غير المسجل من عرض البيانات"""
        response = self.client.get(self.user_info_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)