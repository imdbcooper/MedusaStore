FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN addgroup --system assistant && adduser --system --ingroup assistant assistant

COPY pyproject.toml ./pyproject.toml
COPY backend ./backend
COPY knowledge ./knowledge
COPY ENV.example ./ENV.example

RUN pip install --upgrade pip \
    && pip install . \
    && chown -R assistant:assistant /app

USER assistant

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "backend"]
