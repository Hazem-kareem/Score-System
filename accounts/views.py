from django.core.cache import cache
from django.core.mail import send_mail
from django.shortcuts import render
from rest_framework.decorators import APIView, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from django.conf import settings
from .serializers import *
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from urllib.parse import quote



User = get_user_model()
token_generator = PasswordResetTokenGenerator()

@api_view(['POST'])
@permission_classes([AllowAny])
def Register(request):

    serializer = RegisterSerializer(data = request.data)

    if serializer.is_valid():
        serializer.save()
        return Response(
            {"message":"تم ارسال طلب التسجيل بنجاح, في انتظار موافقة الادمن"},
            status = status.HTTP_201_CREATED
            )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def Login(request):

    serializer = LoginSerializer(data = request.data)

    if serializer.is_valid():
        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access' : str(refresh.access_token),
            'user':CustomUserSerializer(user).data
        }, status=status.HTTP_200_OK)

    return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_info(request):


    user = UserSerializer(request.user)

    return Response(user.data, status=status.HTTP_200_OK)


class ForgetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        user = User.objects.filter(email__iexact=email).first()
        if user:
            token = token_generator.make_token(user)
            reset_link = f"{settings.FRONTEND_URL}/account/reset.html?token={token}&email={quote(email)}"
            send_mail(
                'رابط إعادة تعيين كلمة السر',
                f'اضغط على الرابط التالي لإعادة تعيين كلمة السر:\n{reset_link}',
                settings.EMAIL_HOST_USER,
                [email],
            )

        return Response({'detail': 'لو البريد مسجل عندنا، هيوصلك رابط إعادة التعيين.'})


class ResetPasswordView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data = request.data)

        if serializer.is_valid():
            user = serializer.validated_data['user']
            new_password = serializer.validated_data['new_password']
            user.set_password(new_password)

            user.save()

            return Response({'detail':'تم اعادة تعين لمة المرور'}, status = status.HTTP_200_OK)

        return Response(serializer.errors, status = status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_students(request):
    students = CustomUser.objects.filter(
        role=CustomUser.Role.STUDENT
    ).only('id', 'username', 'first_name', 'last_name', 'email', 'role')
    
    serializer = UserSerializer(students, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_teachers(request):
    teachers = CustomUser.objects.filter(
        role=CustomUser.Role.TEACHER
    ).only('id', 'username', 'first_name', 'last_name', 'email', 'role')
    
    serializer = UserSerializer(teachers, many=True)
    return Response(serializer.data)