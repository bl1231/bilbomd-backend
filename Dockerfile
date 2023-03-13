FROM node:18-bullseye as bilbomd-backend
RUN apt-get update && apt-get install -y ncat
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app
COPY ./package.json ./
COPY ./package-lock.json ./
RUN npm install
COPY --chown=node:node ./ ./
EXPOSE 3500
CMD [ "npm", "run", "dev" ]