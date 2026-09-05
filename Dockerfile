FROM node:20-bookworm

# Cài đặt FFmpeg và font chữ hệ thống trên Debian 12
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Tạo sẵn thư mục lưu trữ trong container
RUN mkdir -p uploads public/outputs

EXPOSE 5000

CMD ["node", "server.js"]