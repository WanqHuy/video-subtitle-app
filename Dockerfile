FROM node:18-bullseye

# Cài đặt FFmpeg đầy đủ bản quyền và bộ lọc libass từ kho Ubuntu/Debian
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]