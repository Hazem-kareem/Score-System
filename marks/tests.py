from decimal import Decimal
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from .models import Mark
from subjects.models import Subject  # غير اسم التطبيق حسب مشروعك لو مختلف

User = get_user_model()


class MarkAPITestCase(APITestCase):

    def setUp(self):
        # 1. تجهيز مستخدمين (أدمن، مدرس، طالب)
        self.admin = User.objects.create_superuser(username='admin', password='password123', role='Admin')
        self.teacher = User.objects.create_user(username='teacher1', password='password123', role='Teacher')
        self.other_teacher = User.objects.create_user(username='teacher2', password='password123', role='Teacher')
        self.student = User.objects.create_user(username='student1', password='password123', role='Student')

        # 2. تجهيز مادة دراسية مسندة للمدرس الأول
        self.subject = Subject.objects.create(subject_name='Science', teacher=self.teacher)

        # 3. تجهيز رابط الـ API الرئيسي
        self.url = reverse('mark-list')  # بيطابق basename='mark' في الراوتر

    # --- اختبارات الإضافة والتسجيل (Create) ---
    def test_teacher_can_create_weekly_mark(self):
        """تأكيد قدرة المدرس على إضافة درجة أسبوعية لطالب وحساب المجموع تلقائياً"""
        self.client.force_authenticate(user=self.teacher)
        data = {
            "student": self.student.id,
            "subject": self.subject.id,
            "period": "week_1",
            "weekly_assessment": "5.00",
            "class_work": "5.00",
            "homework": "5.00"
        }
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(response.data['score']), Decimal('15.00'))

    def test_student_cannot_create_mark(self):
        """تأكيد أن الطالب ممنوع من إضافة درجات (403 Forbidden)"""
        self.client.force_authenticate(user=self.student)
        data = {
            "student": self.student.id,
            "subject": self.subject.id,
            "period": "week_1",
            "weekly_assessment": "5.00"
        }
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_prevent_duplicate_period_mark(self):
        """تأكيد منع رصد أكثر من درجة لنفس الطالب والمادة في نفس الأسبوع"""
        Mark.objects.create(
            student=self.student,
            subject=self.subject,
            period='week_1',
            weekly_assessment=Decimal('5.00')
        )
        self.client.force_authenticate(user=self.teacher)
        data = {
            "student": self.student.id,
            "subject": self.subject.id,
            "period": "week_1",
            "weekly_assessment": "4.00"
        }
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # --- اختبارات التعديل والحسابات (Update) ---
    def test_patch_updates_total_score_correctly(self):
        """تأكيد إعادة حساب المجموع بشكل صحيح عند التعديل الجزئي PATCH"""
        mark = Mark.objects.create(
            student=self.student,
            subject=self.subject,
            period='week_1',
            weekly_assessment=Decimal('4.00'),
            class_work=Decimal('5.00'),
            homework=Decimal('5.00')
        )
        detail_url = reverse('mark-detail', kwargs={'pk': mark.id})
        
        self.client.force_authenticate(user=self.teacher)
        response = self.client.patch(detail_url, {"weekly_assessment": "5.00"}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(response.data['score']), Decimal('15.00'))