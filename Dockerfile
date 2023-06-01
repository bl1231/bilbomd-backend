FROM node:18-bullseye as bilbomd-backend
ARG USER_ID
ARG GROUP_ID

RUN apt-get update && apt-get install -y ncat
RUN mkdir -p /app/node_modules
RUN mkdir -p /bilbomd/uploads
VOLUME [ "/bilbomd/uploads" ]
WORKDIR /app

# Create a user and group with the provided IDs
RUN groupadd -g $GROUP_ID bilbomd && useradd -u $USER_ID -g $GROUP_ID -d /home/node -s /bin/bash bilbo

# Change ownership of directories to the user and group
RUN chown -R bilbo:bilbomd /app /bilbomd/uploads /home/node

# Switch to the non-root user
USER bilbo:bilbomd

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

COPY --chown=bilbo:bilbomd . .

EXPOSE 3500
CMD [ "npm", "start" ]
