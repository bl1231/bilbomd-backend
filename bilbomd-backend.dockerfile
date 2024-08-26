# Build stage 1 - Install Miniforge3
FROM node:20-slim AS bilbomd-backend-step1

RUN apt-get update && \
    apt-get install -y ncat ca-certificates wget libgl1-mesa-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Download and install Miniforge3
RUN wget -q "https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-$(uname)-$(uname -m).sh" && \
    bash Miniforge3-$(uname)-$(uname -m).sh -b -p "/miniforge3" && \
    rm Miniforge3-$(uname)-$(uname -m).sh

# Add Conda to PATH
ENV PATH="/miniforge3/bin/:${PATH}"

# Update conda
RUN conda update -n base -c conda-forge conda && \
    conda update -n base -c defaults conda

# Copy in the environment.yml file
COPY environment.yml /tmp/environment.yml

# Update existing conda base env from environment.yml
RUN conda env update -f /tmp/environment.yml && \
    rm /tmp/environment.yml

# -----------------------------------------------------------------------------
# Build stage 2 - Install BioXTAS
FROM bilbomd-backend-step1 AS bilbomd-backend-step2

# install deps
RUN apt-get update && \
    apt-get install -y zip build-essential libarchive13 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install BioXTAS from source
WORKDIR /tmp
RUN wget -q https://github.com/jbhopkins/bioxtasraw/archive/refs/heads/master.zip -O bioxtasraw-master.zip && \
    unzip bioxtasraw-master.zip && \
    rm bioxtasraw-master.zip

WORKDIR /tmp/bioxtasraw-master
RUN python setup.py build_ext --inplace && \
    pip install .

# -----------------------------------------------------------------------------
# Build stage 3 - Install backend app
FROM bilbomd-backend-step2 AS bilbomd-backend
ARG USER_ID=1001
ARG GROUP_ID=1001
ARG GITHUB_TOKEN

RUN mkdir -p /app/node_modules /bilbomd/uploads /bilbomd/logs
WORKDIR /app

# Create a user and group with the provided IDs
RUN groupadd -g $GROUP_ID bilbomd && \
    useradd -u $USER_ID -g $GROUP_ID -m -d /home/bilbo -s /bin/bash bilbo

# Change ownership of directories to the user and group
RUN chown -R bilbo:bilbomd /app /bilbomd/uploads /bilbomd/logs /home/bilbo

# Update NPM
RUN npm install -g npm@10.8.2

# Switch to the non-root user
USER bilbo:bilbomd

# Copy package.json and package-lock.json
COPY --chown=bilbo:bilbomd package*.json .

# Create .npmrc file using the build argument
RUN echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" > /home/bilbo/.npmrc

# Install dependencies
RUN npm ci --force

# Remove .npmrc file for security
RUN rm /home/bilbo/.npmrc

# Copy entire backend app
COPY --chown=bilbo:bilbomd . .

EXPOSE 3500

CMD [ "npm", "start" ]
