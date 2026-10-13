from decimal import Decimal, InvalidOperation

from django.db.models import Q, ProtectedError
from rest_framework import viewsets, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Espacio, RecursoTecnico
from .serializers import EspacioSerializer, RecursoTecnicoSerializer


def _decimal(request, nombre):
    valor = request.query_params.get(nombre)
    if valor in (None, ''):
        return None
    try:
        return Decimal(valor)
    except InvalidOperation:
        raise ValidationError({nombre: 'Debe ser un número decimal válido.'})


class EspacioViewSet(viewsets.ModelViewSet):
    serializer_class = EspacioSerializer

    def get_queryset(self):
        qs = Espacio.objects.all()
        estado = self.request.query_params.get('estado')
        q = self.request.query_params.get('q')
        if estado:
            qs = qs.filter(estado=estado)
        if q:
            qs = qs.filter(Q(nombre__icontains=q) | Q(ubicacion__icontains=q))
        return qs

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {'detail': 'No se puede eliminar: el espacio aún tiene recursos técnicos asignados.'},
                status=status.HTTP_409_CONFLICT)


class RecursoTecnicoViewSet(viewsets.ModelViewSet):
    serializer_class = RecursoTecnicoSerializer

    def get_queryset(self):
        qs = RecursoTecnico.objects.select_related('espacio')
        p = self.request.query_params
        espacio = p.get('espacio')
        if espacio:
            if not espacio.isdigit():
                raise ValidationError({'espacio': 'Debe ser el id numérico de un espacio.'})
            qs = qs.filter(espacio_id=int(espacio))
        costo_min = _decimal(self.request, 'costo_min')
        costo_max = _decimal(self.request, 'costo_max')
        if costo_min is not None:
            qs = qs.filter(costo__gte=costo_min)
        if costo_max is not None:
            qs = qs.filter(costo__lte=costo_max)
        q = p.get('q')
        if q:
            qs = qs.filter(Q(nombre__icontains=q) | Q(codigo_inventario__icontains=q))
        return qs


class SesionView(APIView):
    """Deja que el cliente web compruebe si sus credenciales son válidas."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'usuario': request.user.get_username()})