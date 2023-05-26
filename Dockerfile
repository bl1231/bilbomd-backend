FROM node:18-bullseye as bilbomd-backend
RUN apt-get update && apt-get install -y ncat
RUN mkdir -p /home/node/app/node_modules
RUN chown -R node:node /home/node/app
RUN mkdir -p /bilbomd/uploads
RUN chown -R node:node /bilbomd/uploads
VOLUME [ "/bilbomd/uploads" ]
WORKDIR /home/node/app
# Switch to the non-root user
USER node
# Copy package.json and package-lock.json
COPY package*.json ./
# Install dependencies
RUN npm ci --only=production
COPY . .
EXPOSE 3500
CMD [ "npm", "start" ]