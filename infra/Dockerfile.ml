FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY services/ml/pyproject.toml services/ml/requirements.lock ./
COPY services/ml/src ./src
RUN pip install --no-cache-dir -r requirements.lock && pip install --no-cache-dir --no-deps .
RUN groupadd -r app && useradd -r -g app app
USER app
EXPOSE 8001
CMD ["uvicorn", "smart_waste_ml.main:app", "--host", "0.0.0.0", "--port", "8001", "--no-access-log"]

FROM runtime AS test
USER root
RUN pip install --no-cache-dir '.[test]'
COPY services/ml/tests /workspace/services/ml/tests
COPY ml/pixels.py /workspace/ml/pixels.py
USER app
CMD ["pytest", "-q", "/workspace/services/ml/tests"]
