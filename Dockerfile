# syntax=docker/dockerfile:1
FROM node:18-slim

WORKDIR /app

# Instala dependências de build
RUN apt-get update && apt-get install -y python3 make g++

# Copia somente package.json e package-lock.json para instalar as dependências
COPY package*.json ./

# Instala as dependências com bcrypt compilado corretamente
RUN npm install --production
RUN npm install -g nodemon

# Copia o restante dos arquivos do projeto
COPY . .

# Cria diretório de uploads
RUN mkdir -p ./uploads

# Expõe a porta
EXPOSE 3000

CMD ["npm", "start"]
