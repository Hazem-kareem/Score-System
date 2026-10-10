from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import *
from django.contrib.auth import authenticate
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from rest_framework.validators import UniqueValidator

User = get_user_model()
token_generator = PasswordResetTokenGenerator()


class CustomUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username','email', 'role', 'first_name', 'last_name']
        read_only_fields = ['id']

class RegisterSerializer(serializers.ModelSerializer):

    username = serializers.CharField(
        validators=[UniqueValidator(queryset=User.objects.all(), message="اسم المستخدم مستخدم بالفعل.")]
    )

    email = serializers.EmailField(
        validators = [UniqueValidator(queryset=User.objects.all(), message="الايميل مستخدم بالفعل")]
    )
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password']

    def create(self, validated_data):

        user = User.objects.create_user(
            username=validated_data['username'],
            email = validated_data.get('email', ''),
            password= validated_data['password'],
            first_name = validated_data.get('first_name', ''),
            last_name = validated_data.get('last_name', '')
        )

        return user

class LoginSerializer(serializers.Serializer):

    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):

        username = data.get("username")
        password = data.get("password")

        user = authenticate(username=username, password=password)

        if not user:
            raise serializers.ValidationError("اسم المستخدم او كلمة المرور غير صحيحة")

        if user.role == "Pending":
            raise serializers.ValidationError("حسابك قيد الانتظار، في انتظار موافقة الأدمن.")

        data['user'] = user       
        return data

class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ('id', 'username', 'first_name', 'last_name', 'full_name', 'email', 'role')

    def get_full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name if name else obj.username


class ForgetPasswordSerializer(serializers.Serializer):

    email = serializers.EmailField()

    


class ResetPasswordSerializer(serializers.Serializer):

    email = serializers.EmailField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)


    def validate(self, attrs):
        email = attrs.get('email')
        token = attrs.get('token')

        try:
            user = User.objects.filter(email__iexact=email).first()

        except User.DoesNotExist:
            raise serializers.ValidationError({'email':'البريد الالكتروني غير مسجل لدينا'})


        if not token_generator.check_token(user, token):
            raise serializers.ValidationError({'token': "الرمز غير صالح او انتهت الصلاحية"})

        attrs['user'] = user

        return attrs