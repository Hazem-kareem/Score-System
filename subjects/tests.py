from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APITestCase
from rest_framework import status
from .models import Subject

User = get_user_model()


class SubjectAPITestCase(APITestCase):

    def setUp(self):
        # 1. مسح الكاش قبل كل اختبار لضمان عدم تداخل البيانات
        cache.clear()

        # 2. إنشاء المستخدمين (أدمن، مدرس، طالب)
        self.admin = User.objects.create_superuser(username='admin_user', password='password123', role='Admin')
        self.teacher = User.objects.create_user(username='teacher_user', password='password123', role='Teacher')
        self.student = User.objects.create_user(username='student_user', password='password123', role='Student')

        # 3. إنشاء مادة أولية للاختبار
        self.subject = Subject.objects.create(
            subject_name=Subject.SubjectName.SCIENCE,
            teacher=self.teacher
        )

        # 4. المسارات المباشرة لـ API المواد
        self.list_url = '/api/subjects/'
        self.detail_url = f'/api/subjects/{self.subject.pk}/'

    # --- 1. اختبارات العرض (Read / List) ---
    def test_authenticated_user_can_list_subjects(self):
        """تأكيد أن أي مستخدم مسجل دخول (حتى الطالب) يمكنه رؤية قائمة المواد"""
        self.client.force_authenticate(user=self.student)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data) > 0)

    def test_unauthenticated_user_cannot_list_subjects(self):
        """تأكيد أن الزائر غير المسجل يمنع من رؤية القائمة (401 Unauthorized)"""
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # --- 2. اختبارات الإضافة والصلاحيات (Create & Permissions) ---
    def test_teacher_or_admin_can_create_subject(self):
        """تأكيد قدرة المدرس أو الأدمن على إضافة مادة جديدة"""
        self.client.force_authenticate(user=self.teacher)
        data = {
            "subject_name": Subject.SubjectName.MATHEMATICS,
            "teacher": self.teacher.id
        }
        response = self.client.post(self.list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['subject_name'], Subject.SubjectName.MATHEMATICS)

    def test_student_cannot_create_subject(self):
        """تأكيد منع الطالب من إضافة مادة دراسية (403 Forbidden)"""
        self.client.force_authenticate(user=self.student)
        data = {
            "subject_name": Subject.SubjectName.ENGLISH,
            "teacher": self.teacher.id
        }
        response = self.client.post(self.list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # --- 3. اختبارات الـ Validation ---
    def test_cannot_assign_non_teacher_as_subject_teacher(self):
        """تأكيد فشل الإضافة إذا تم اختيار طالب كمدرس للمادة"""
        self.client.force_authenticate(user=self.admin)
        data = {
            "subject_name": Subject.SubjectName.ARABIC,
            "teacher": self.student.id  # اختيار طالب بدل مدرس
        }
        response = self.client.post(self.list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('teacher', response.data)

    def test_cannot_create_duplicate_subject_name(self):
        """تأكيد منع تكرار اسم المادة بنفس الاسم (Unique constraint)"""
        self.client.force_authenticate(user=self.admin)
        data = {
            "subject_name": Subject.SubjectName.SCIENCE,  # موجودة بالفعل في setUp
            "teacher": self.teacher.id
        }
        response = self.client.post(self.list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # --- 4. اختبارات التعديل والحذف (Update & Delete) ---
    def test_admin_can_update_subject(self):
        """تأكيد قدرة الأدمن على تعديل المادة ومدرسها"""
        self.client.force_authenticate(user=self.admin)
        data = {
            "subject_name": Subject.SubjectName.SCIENCE,
            "teacher": None  # إزالة المدرس
        }
        response = self.client.put(self.detail_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['teacher'])

    def test_admin_can_delete_subject(self):
        """تأكيد قدرة الأدمن على حذف المادة"""
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Subject.objects.filter(pk=self.subject.pk).exists())