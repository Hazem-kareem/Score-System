from rest_framework import serializers
from django.contrib.auth import get_user_model
from subjects.serializers import SubjectDetailSerializer
from .models import Mark

User = get_user_model()


class UserSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class MarkDetailSerializer(serializers.ModelSerializer):
    student = UserSimpleSerializer(read_only=True)
    subject = SubjectDetailSerializer(read_only=True)
    period_display = serializers.CharField(source='get_period_display', read_only=True)

    class Meta:
        model = Mark
        fields = [
            'id', 
            'student', 
            'subject', 
            'period', 
            'period_display',
            'weekly_assessment', 
            'class_work', 
            'homework', 
            'monthly_exam', 
            'score', 
            'created_at', 
            'updated_at'
        ]


class MarkWriteSerializer(serializers.ModelSerializer):
    score = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = Mark
        fields = [
            'id',
            'student',
            'period',
            'subject',
            'weekly_assessment',
            'class_work',
            'homework',
            'monthly_exam',
            'score'
        ]

    def to_representation(self, instance):
        return MarkDetailSerializer(instance, context=self.context).data

    def validate_student(self, value):
        if getattr(value, 'role', None) != 'Student':
            raise serializers.ValidationError('المستخدم المحدد ليس طالباً.')
        return value

    def validate_period(self, value):
        valid_periods = [choice[0] for choice in Mark.WeekNumber.choices]
        if value not in valid_periods:
            raise serializers.ValidationError('الفترة أو الأسبوع المحدد غير صالح.')
        return value

    def validate(self, attrs):
        request = self.context.get('request')
        user = request.user if request else None

        student = attrs.get('student') or (self.instance.student if self.instance else None)
        subject = attrs.get('subject') or (self.instance.subject if self.instance else None)
        period = attrs.get('period') or (self.instance.period if self.instance else None)

        if getattr(user, 'role', None) == 'Teacher':
            if subject and subject.teacher != user:
                raise serializers.ValidationError({
                    "subject": "ليس لديك صلاحية رصد أو تعديل درجات لهذه المادة لأنها غير مسندة إليك."
                })

        query = Mark.objects.filter(student=student, subject=subject, period=period)
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
            
        if query.exists():
            raise serializers.ValidationError({
                "period": "تم رصد درجات لهذا الطالب في هذه المادة لهذه الفترة بالفعل."
            })

        weekly_assessment = attrs.get('weekly_assessment', getattr(self.instance, 'weekly_assessment', None))
        class_work = attrs.get('class_work', getattr(self.instance, 'class_work', None))
        homework = attrs.get('homework', getattr(self.instance, 'homework', None))
        monthly_exam = attrs.get('monthly_exam', getattr(self.instance, 'monthly_exam', None))

        is_monthly_exam = period in [Mark.WeekNumber.MONTH_1_EXAM, Mark.WeekNumber.MONTH_2_EXAM]

        if is_monthly_exam:
            if monthly_exam is None:
                raise serializers.ValidationError({
                    "monthly_exam": "يجب إدخال درجة امتحان الشهر عند اختيار امتحانات الشهر."
                })
        else:
            fields_provided = [weekly_assessment, class_work, homework]
            if all(v is None for v in fields_provided):
                raise serializers.ValidationError({
                    "non_field_errors": "يجب إدخال درجة واحدة على الأقل (تقييم أسبوعي، أداء صفي، أو واجب منزل) لهذا الأسبوع."
                })

        return attrs