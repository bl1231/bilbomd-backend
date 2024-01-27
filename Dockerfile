FROM continuumio/miniconda3 as bilbomd-backend
ARG USER_ID=1001
ARG GROUP_ID=1001
ARG NODE_MAJOR=20

RUN apt-get update
RUN apt-get install -y \
    ncat \
    ca-certificates \
    curl \
    gnupg \
    zip

RUN mkdir -p /etc/apt/keyrings
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list

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
# and BioXTAS 
RUN conda install pillow six wheel numpy=1.24.3 scipy=1.10.1 matplotlib numba h5py cython numexpr reportlab
RUN conda install -c conda-forge python-igraph=0.10.4 dbus-python fabio pyfai hdf5plugin mmcif_pdbx svglib

# install BioXTAS
RUN apt-get install -y build-essential

# Create a directory for BioXTAS and copy the source ZIP file
RUN mkdir /BioXTAS
COPY RAW-2.2.1-source.zip /BioXTAS/

# Change the working directory to BioXTAS
WORKDIR /BioXTAS

# Unzip the source ZIP file
RUN unzip RAW-2.2.1-source.zip

# Build BioXTAS using Python setup.py
RUN python setup.py build_ext --inplace

# Install BioXTAS using pip
RUN pip install .

# Switch to the non-root user
USER bilbo:bilbomd

# switch back so we can install bilbomd-backend
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

COPY --chown=bilbo:bilbomd . .

# This can be mapped to a different port of the Docker host
EXPOSE 3500

# this can be overridden in docker-compose.dev.yml
CMD [ "npm", "start" ]
