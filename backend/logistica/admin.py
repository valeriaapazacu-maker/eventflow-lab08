from django.contrib import admin
from .models import Espacio, RecursoTecnico


@admin.register(Espacio)
class EspacioAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'ubicacion', 'aforo_maximo', 'estado')
    list_filter = ('estado', 'ubicacion')
    search_fields = ('nombre', 'ubicacion')


@admin.register(RecursoTecnico)
class RecursoTecnicoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'codigo_inventario', 'espacio', 'costo', 'stock')
    list_filter = ('espacio', 'espacio__estado')
    search_fields = ('nombre', 'codigo_inventario')