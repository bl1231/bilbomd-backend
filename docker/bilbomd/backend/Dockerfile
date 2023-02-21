FROM node:18-alpine

RUN apk update && apk add perl perl-dev

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY ./package*.json ./

RUN npm install

COPY --chown=node:node . .

EXPOSE 3500

CMD [ "npm", "run", "dev" ]