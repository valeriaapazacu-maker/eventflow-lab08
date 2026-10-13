from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EspacioViewSet, RecursoTecnicoViewSet, SesionView

router = DefaultRouter()
router.register('espacios', EspacioViewSet, basename='espacio')
router.register('recursos', RecursoTecnicoViewSet, basename='recurso')

urlpatterns = [
    path('sesion/', SesionView.as_view(), name='sesion'),
    path('', include(router.urls)),
]