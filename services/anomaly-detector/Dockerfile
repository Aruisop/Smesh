FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Train the model at build time so it's ready
RUN python model.py

CMD ["python", "-u", "main.py"]
