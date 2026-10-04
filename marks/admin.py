from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import Mark

@admin.register(Mark)
class MarkAdmin(ModelAdmin):
    list_display = ('student', 'subject', 'period', 'score', 'created_at')
    list_filter = ('period', 'subject')
    search_fields = ('student__username', 'subject__subject_name')
    list_per_page = 20