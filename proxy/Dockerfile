FROM node:20-alpine

WORKDIR /app

# 依存パッケージのインストール
COPY package*.json ./
RUN npm ci --only=production

# ソースコードと秘密鍵をコピー
COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
