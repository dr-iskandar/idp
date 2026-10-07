FROM python:3.9-slim

WORKDIR /usr/src/app

COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --upgrade openai
RUN pip install python-dotenv
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

COPY . .

EXPOSE 3336

ENV FLASK_APP=WideIDP.py

CMD ["python", "WideIDP.py"]
