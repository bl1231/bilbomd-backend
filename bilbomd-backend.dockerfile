# -----------------------------------------------------------------------------
# Build stage 1 - Install Miniforge3
FROM node:20-slim as bilbomd-backend-step1

RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get update && \
    apt-get install -y ncat ca-certificates wget libgl1-mesa-dev

# Download and install Miniforge3
RUN wget "https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-$(uname)-$(uname -m).sh" && \
    bash Miniforge3-$(uname)-$(uname -m).sh -b -p "/miniforge3" && \
    rm Miniforge3-$(uname)-$(uname -m).sh

# Add Conda to PATH
ENV PATH="/miniforge3/bin/:${PATH}"

# Update conda
RUN conda update -n base -c conda-forge conda
RUN conda update -n base -c defaults conda

# Verify Miniconda3 installation
RUN conda --version

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
    apt-get install -y zip build-essential libarchive13

# Install BioXYAS from source
WORKDIR /tmp
# RUN git clone https://github.com/jbhopkins/bioxtasraw.git
COPY bioxtas/bioxtasraw-master.zip .
RUN unzip bioxtasraw-master.zip && rm bioxtasraw-master.zip
# Install BioXTAS RAW from source
WORKDIR /tmp/bioxtasraw-master
RUN python setup.py build_ext --inplace && \
    pip install .

# -----------------------------------------------------------------------------
# Build stage 3 - Install backend app
FROM bilbomd-backend-step2 AS bilbomd-backend
ARG USER_ID=1001
ARG GROUP_ID=1001
RUN mkdir -p /app/node_modules
RUN mkdir -p /bilbomd/uploads
WORKDIR /app

# Create a user and group with the provided IDs
RUN mkdir /home/bilbo

RUN groupadd -g $GROUP_ID bilbomd && useradd -u $USER_ID -g $GROUP_ID -d /home/bilbo -s /bin/bash bilbo

# Change ownership of directories to the user and group
RUN chown -R bilbo:bilbomd /app /bilbomd/uploads /home/bilbo

# update NPM
RUN npm install -g npm@10.7.0

# Switch to the non-root user
USER bilbo:bilbomd

# switch back so we can install bilbomd-backend
WORKDIR /app

# Copy package.json and package-lock.json
COPY --chown=bilbo:bilbomd package*.json .

# Install dependencies
RUN npm ci

# Copy entire backend app
COPY --chown=bilbo:bilbomd . .

EXPOSE 3500

# this can be overridden in docker-compose.dev.yml
CMD [ "npm", "start" ]