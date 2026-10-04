from django.shortcuts import render
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from core import settings
from .serializers import *
from .permissions import IsTeacherOrAdmin
from .models import Subject
from django.core.cache import cache
from rest_framework.response import Response



class SubjectViewSet(viewsets.ModelViewSet):

    queryset = Subject.objects.all().select_related('teacher')

    def get_serializer_class(self):

        if self.action in ['create', 'update', 'partial_update']:
            return SubjectCreateUpdateSerializer

        return SubjectDetailSerializer

    def get_permissions(self):

        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsTeacherOrAdmin]

        else:

            permission_classes = [IsAuthenticated]

        return [permission() for permission in permission_classes]

    def list(self, request, *args, **kwargs):
        cache_key = 'subjects_list_all'
        cached_data = cache.get(cache_key)

        if cached_data:
            return Response(cached_data)

        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, response.data, timeout=getattr(settings, 'CACHE_TTL', 3600))

        return response
