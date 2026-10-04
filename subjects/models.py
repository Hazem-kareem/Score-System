from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Subject(models.Model):

    class SubjectName(models.TextChoices):
            SCIENCE = "Science", "Science"
            MATHEMATICS = "Mathematics", "Mathematics"
            ENGLISH = "English", "English"
            CONNECT_PLUS = "Connect Plus", "Connect Plus"
            ARABIC = "Arabic", "Arabic"
            GERMAN = "German", "German"
            SPANISH = "Spanish", "Spanish"
            FRENCH = "French", "French"
            ITALIAN = "Italian", "Italian"
            RELIGION = "Religion", "Religion"
            COMPUTER = "Computer", "Computer"

    subject_name = models.CharField(
        max_length=100,
        choices= SubjectName.choices,
        unique=True
        )

    teacher = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        limit_choices_to={'role':'Teacher'},
        related_name='subjects'
    )

    class Meta:
        indexes = [
            models.Index(fields=['subject_name']), 
            models.Index(fields=['teacher']), 
        ]

    def __str__(self):
        return f"{self.subject_name} - {self.teacher.username if self.teacher else 'No Teacher'}"