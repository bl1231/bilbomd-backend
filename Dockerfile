FROM node:18-alpine

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY package*.json ./

RUN npm install
RUN npm i bullmq

COPY --chown=node:node . .

EXPOSE 3500

CMD [ "npm", "run", "dev" ]