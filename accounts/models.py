from django.db import models
from django.contrib.auth.models import AbstractUser
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache

class CustomUser(AbstractUser):

    class Role(models.TextChoices):
        TEACHER = "Teacher"
        STUDENT = "Student"
        ADMIN = "Admin"
        PENDING = "Pending"

    role = models.CharField(
        max_length = 20,
        choices= Role.choices,
        default=Role.PENDING
    )


    def __str__(self):
        return f'{self.username} - {self.role}'

