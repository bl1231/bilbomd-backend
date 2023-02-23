FROM debian:bullseye AS builder
RUN apt-get update && apt-get install -y cmake gcc gfortran g++

FROM builder AS config_charmm
WORKDIR /usr/local/src
COPY ./charmm/c47b1.tar.gz ./
RUN tar zxvf c47b1.tar.gz
WORKDIR /usr/local/src/charmm
RUN ./configure

FROM config_charmm AS build_charmm
WORKDIR /usr/local/src/charmm
RUN make -j8 -C build/cmake install

FROM node:18-bullseye
COPY --from=build_charmm /usr/local/src/charmm/bin/charmm /usr/local/bin/
RUN apt-get update && apt-get install -y perl ncat gfortran

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY ./package*.json ./

RUN npm install

COPY --chown=node:node . .

EXPOSE 3500

CMD [ "npm", "run", "dev" ]