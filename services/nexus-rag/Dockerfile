FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY services/nexus-rag/requirements.txt /app/requirements.txt

RUN pip install --no-cache-dir --upgrade pip

RUN pip install --no-cache-dir \
    torch==2.5.1 \
    --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir \
    -r /app/requirements.txt


COPY proto/ /app/proto/

RUN mkdir -p /app/proto_out && \
    python -m grpc_tools.protoc \
    -I/app/proto/rag \
    --python_out=/app/proto_out \
    --grpc_python_out=/app/proto_out \
    /app/proto/rag/rag.proto && \
    touch /app/proto_out/__init__.py

COPY services/nexus-rag/app/ /app/app/

EXPOSE 8080

CMD ["python", "-m", "app.main"]