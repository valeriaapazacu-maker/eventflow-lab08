import re
from rest_framework import serializers
from .models import Espacio, RecursoTecnico

CODIGO_VALIDO = re.compile(r'^[A-Z0-9-]{3,40}$')


class EspacioSerializer(serializers.ModelSerializer):
    total_recursos = serializers.IntegerField(source='recursos.count', read_only=True)

    class Meta:
        model = Espacio
        fields = ('id', 'nombre', 'ubicacion', 'aforo_maximo', 'estado', 'total_recursos')

    def validate_nombre(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError('El nombre debe tener al menos 3 caracteres.')
        return value

    def validate_aforo_maximo(self, value):
        if value <= 0:
            raise serializers.ValidationError('El aforo máximo debe ser mayor que cero.')
        return value


class EspacioResumenSerializer(serializers.ModelSerializer):
    class Meta:
        model = Espacio
        fields = ('id', 'nombre', 'ubicacion', 'estado')


class RecursoTecnicoSerializer(serializers.ModelSerializer):
    # Información del espacio asociado (solo lectura)
    espacio_detalle = EspacioResumenSerializer(source='espacio', read_only=True)

    class Meta:
        model = RecursoTecnico
        fields = ('id', 'nombre', 'codigo_inventario', 'costo', 'stock', 'espacio', 'espacio_detalle')

    def validate_nombre(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError('El nombre debe tener al menos 3 caracteres.')
        return value

    def validate_codigo_inventario(self, value):
        value = value.strip().upper()
        if not CODIGO_VALIDO.match(value):
            raise serializers.ValidationError(
                'Usa solo letras, números y guiones (entre 3 y 40 caracteres).')
        repetidos = RecursoTecnico.objects.filter(codigo_inventario=value)
        if self.instance:
            repetidos = repetidos.exclude(pk=self.instance.pk)
        if repetidos.exists():
            raise serializers.ValidationError('Ya existe un recurso con ese código de inventario.')
        return value

    def validate_costo(self, value):
        if value <= 0:
            raise serializers.ValidationError('El costo debe ser mayor que cero.')
        return value

    def validate(self, attrs):
        espacio = attrs.get('espacio')
        if espacio and espacio.estado == Espacio.Estado.FUERA_SERVICIO:
            raise serializers.ValidationError(
                {'espacio': 'No se pueden asignar equipos a un espacio fuera de servicio.'})
        return attrs