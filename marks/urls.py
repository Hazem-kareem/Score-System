from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MarkViewSet

router = DefaultRouter()
router.register(r'', MarkViewSet, basename='mark')

urlpatterns = [
    path('', include(router.urls)),
]