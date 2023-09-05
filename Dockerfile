FROM continuumio/miniconda3 as bilbomd-backend
ARG USER_ID
ARG GROUP_ID

RUN apt-get update
RUN apt-get install -y \
    ncat \
    ca-certificates \
    curl \
    gnupg

RUN mkdir -p /etc/apt/keyrings
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_18.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list

RUN apt-get update
RUN apt-get install nodejs -y

RUN mkdir -p /app/node_modules
RUN mkdir -p /bilbomd/uploads
VOLUME [ "/bilbomd/uploads" ]
WORKDIR /app

# Create a user and group with the provided IDs
RUN mkdir /home/bilbo
RUN groupadd -g $GROUP_ID bilbomd && useradd -u $USER_ID -g $GROUP_ID -d /home/bilbo -s /bin/bash bilbo

# Change ownership of directories to the user and group
RUN chown -R bilbo:bilbomd /app /bilbomd/uploads /home/bilbo

# install Python packages needed for the PAE const.inp script
RUN conda install numpy 
RUN conda install -c conda-forge python-igraph

# Switch to the non-root user
USER bilbo:bilbomd

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

COPY --chown=bilbo:bilbomd . .

# This can be mapped to a different port of the Docker host
EXPOSE 3500

# this can be overridden in docker-compose.dev.yml
CMD [ "npm", "start" ]
