from decimal import Decimal

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from subjects.models import Subject
from django.contrib.auth import get_user_model

User = get_user_model()

class Mark(models.Model):

    class WeekNumber(models.TextChoices):
        WEEK_1 = "week_1", "Week 1"
        WEEK_2 = "week_2", "Week 2"
        WEEK_3 = "week_3", "Week 3"
        WEEK_4 = "week_4", "Week 4"
        WEEK_5 = "week_5", "Week 5"
        WEEK_6 = "week_6", "Week 6"
        WEEK_7 = "week_7", "Week 7"
        WEEK_8 = "week_8", "Week 8"
        WEEK_9 = "week_9", "Week 9"
        WEEK_10 = "week_10", "Week 10"
        WEEK_11 = "week_11", "Week 11"
        WEEK_12 = "week_12", "Week 12"
        WEEK_13 = "week_13", "Week 13"
        WEEK_14 = "week_14", "Week 14"
        WEEK_15 = "week_15", "Week 15"
        WEEK_16 = "week_16", "Week 16"
        MONTH_1_EXAM = "month_1_exam", "Month 1 Exam"
        MONTH_2_EXAM = "month_2_exam", "Month 2 Exam"

    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name='marks'
    )

    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='marks',
        limit_choices_to={"role": "Student"}
    )

    period = models.CharField(
        max_length=20,
        choices=WeekNumber.choices,
        default=WeekNumber.WEEK_1
    )

    weekly_assessment = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[
            MinValueValidator(Decimal('0.00')),
            MaxValueValidator(Decimal('100.00'))
        ]
    )

    class_work = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[
            MinValueValidator(Decimal('0.00')),
            MaxValueValidator(Decimal('100.00'))
        ]
    )

    homework = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[
            MinValueValidator(Decimal('0.00')),
            MaxValueValidator(Decimal('100.00'))
        ]
    )

    monthly_exam = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[
            MinValueValidator(Decimal('0.00')),
            MaxValueValidator(Decimal('100.00'))
        ]
    )

    score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[
            MinValueValidator(Decimal('0.00')),
            MaxValueValidator(Decimal('100.00'))
        ],
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('student', 'subject', 'period')
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['student', 'subject', 'period']),
            models.Index(fields=['student', 'subject']),
            models.Index(fields=['period']),
            models.Index(fields=['student']),
            models.Index(fields=['subject']),
        ]

    def total_score(self):

        weekly = self.weekly_assessment or Decimal('0.00')
        cw = self.class_work or Decimal('0.00')
        hw = self.homework or Decimal('0.00')
        return weekly + cw + hw

    def save(self, *args, **kwargs):
        self.score = self.total_score()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student.username} - {self.subject.subject_name} ({self.get_period_display()}): {self.score}"