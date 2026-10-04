from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAuthenticated
from .models import Mark
from .serializers import *
from .permissions import *


class MarkViewSet(viewsets.ModelViewSet):

    permission_classes = [IsAuthenticated, IsTeacherOrAdminForWrite, IsMarkSubjectTeacherOrAdmin]

    # Filter
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['subject', 'student', 'period']
    ordering_fields = ['created_at', 'score']
    ordering = ['-created_at']

    def get_serializer_class(self):

        if self.action in ['list', 'retrieve']:
            return MarkDetailSerializer

        return MarkWriteSerializer

    def get_queryset(self):

        user = self.request.user
        base_queryset = Mark.objects.select_related('student', 'subject', 'subject__teacher')

        if user.is_staff or getattr(user, 'role', None) == "Admin":

            return base_queryset
        
        if  getattr(user, 'role', None) == "Teacher":

            return base_queryset.filter(subject__teacher=user)

        return base_queryset.filter(student=user)

    def perform_create(self, serializer):
        
        serializer.save()







