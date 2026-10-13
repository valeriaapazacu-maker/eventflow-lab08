# EventFlow - Laboratorio 08
API REST con Django para gestionar espacios y recursos técnicos, con cliente web en HTML, CSS y JavaScript.

## Ejecución
1. Dentro de `backend`: crear entorno virtual e instalar `pip install -r requirements.txt`.
2. Copiar `.env.example` como `.env` y completar los valores.
3. Ejecutar `python manage.py migrate` y `python manage.py runserver`.
4. Dentro de `cliente`: `python -m http.server 5500` y abrir http://127.0.0.1:5500