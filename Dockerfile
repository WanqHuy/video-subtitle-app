FROM node:18-bookworm

# Cài đặt FFmpeg kèm font hệ thống, bỏ qua driver đồ họa thừa để tránh lỗi 404
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]