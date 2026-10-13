from django.db import models


class Espacio(models.Model):
    class Estado(models.TextChoices):
        OPERATIVO = 'operativo', 'Operativo'
        MANTENIMIENTO = 'mantenimiento', 'En mantenimiento'
        FUERA_SERVICIO = 'fuera_servicio', 'Fuera de servicio'

    nombre = models.CharField(max_length=120)
    ubicacion = models.CharField('ubicación / bloque', max_length=120)
    aforo_maximo = models.PositiveIntegerField('aforo máximo')
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.OPERATIVO)

    class Meta:
        ordering = ['nombre']
        verbose_name_plural = 'espacios'

    def __str__(self):
        return f'{self.nombre} ({self.ubicacion})'


class RecursoTecnico(models.Model):
    nombre = models.CharField(max_length=120)
    codigo_inventario = models.CharField('código de inventario', max_length=40, unique=True)
    costo = models.DecimalField('costo de alquiler/mantenimiento', max_digits=10, decimal_places=2)
    stock = models.PositiveIntegerField(default=0)
    # PROTECT: no deja borrar un espacio que aún tiene equipos
    espacio = models.ForeignKey(Espacio, on_delete=models.PROTECT, related_name='recursos')

    class Meta:
        ordering = ['espacio__nombre', 'nombre']
        verbose_name = 'recurso técnico'
        verbose_name_plural = 'recursos técnicos'

    def __str__(self):
        return f'{self.nombre} [{self.codigo_inventario}]'