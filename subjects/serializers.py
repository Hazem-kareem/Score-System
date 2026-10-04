from rest_framework import serializers
from .models import *
from accounts.serializers import CustomUserSerializer


class SubjectDetailSerializer(serializers.ModelSerializer):

    teacher = CustomUserSerializer(read_only=True)

    class Meta:
        model = Subject
        fields = ('id', 'subject_name', 'teacher')


class SubjectCreateUpdateSerializer(serializers.ModelSerializer):

    class Meta:
        model = Subject
        fields = ('id', 'subject_name', 'teacher')

    def validate_teacher(self, value):

        if value and value.role != 'Teacher':
            raise serializers.ValidationError('المستخدم المختار ليس مدرس')

        return value

    