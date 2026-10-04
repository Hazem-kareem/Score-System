from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import Subject

@admin.register(Subject)
class SubjectAdmin(ModelAdmin):
    list_display = ('id', 'subject_name', 'teacher')
    list_filter = ('subject_name',)
    search_fields = ('subject_name', 'teacher__username')
    list_per_page = 20