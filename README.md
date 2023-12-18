# bilbomd-backend

Provides backend support for bilbomd-ui

## Description

`bilbomd-backend` provides authentication and authorization functionality for the `bilbomd-ui` front end application. It also provides several API functionalities for authentication, user creation/editing, and BilboMD job creation. The `bilbomd-backend` also provides an interface to MongoDB which provides a persistant store for User and Job records. The `bilbomd-backend` server also mediates the addition of BilboMD jobs to the BullMQ queueing system. BilboMD jobs are then processed exclusively by `bilbomd-worker`s.

## Getting Started

### Technologies Used

- [![NodeJS][NodeJS]][NodeJS-url]
- [![MongoDB][MongoDB]][MongoDB-url]
- [![ExpressJS][ExpressJS]][ExpressJS-url]
- [![Docker][Docker]][Docker-url]
- [![Redis][Redis]][Redis-url]
- [![BullMQ][BullMQ]][BullMQ-url]

### Installing

`bilbomd-backend` is most easily installed via docker compose as a docker container along side the redis and mongodb containers. Please see the `bilbomd` [instructions](https://github.com/bl1231/bilbomd)

### Instructions for installing a develoment instance of the backend

Clone the repo.

```
cd /wherever/this/will/live
git clone https://github.com/bl1231/bilbomd-backend
```

Install the Node.js dependencies for testing purposes, but keep in mind that these will be installed **inside** the Docker container when you run `docker compose build` from the `bilbomd` [main project](https://github.com/bl1231/bilbomd).

```
npm install
```

### Run tests

```bash
npm run test
```

### Run program

Production is run via docker compose. However, for interactive local development efforts you might be able to:

```bash
npm run dev
```

However, `bilbomd-backend` needs to communicate with Redis and MongoDB which are typically running in separate Docker images so you would likely have to fiddle with PORT values etc. in order to run in "dev" mode within a local terminal. It will be much easier to use docker compose and develop directly within the `bilbomd-dev` environment. Details can be found in `bilbomd` repo. Briefly, the entry point for the `backend` service in `bilbomd-dev` has been set as:

```
command: [ "npm", "run", "dev" ]
```

and the local directory has been mounted inside the docker image:

```
    volumes:
      - ./bilbomd-backend:/app
```

This makes it so that `bilbomd-backend` will automatically restart inside the docker image anytime changes are made to source files.

## Build docker image

To test if the `Dockerfile` will build you can use this command:

```bash
docker build --build-arg USER_ID=1001 --build-arg GROUP_ID=1001 .
```

## Authors

- Scott Classen sclassen at lbl dot gov
- Michal Hammel mhammel at lbl dot gov

## Version History

- 1.3.7
  - fix bug when deleting users
  - adjust the Mongoose schema
- 1.3.6
  - Upgrade mongoose from 7.6.3 to 8.0.2
- 1.3.5
  - Jest test files have been converted to Typescript
- 1.3.4
  - Remove unused CHARMM handlebars templates
- 1.3.3
  - Set defualt `conformational_sampling` to `3`
- 1.3.2
  - Bug fixes
- 1.3.1
  - update the `pae_ratios.py` script
- 1.3.0
  - Migrate most Javascript code to Typescript
- 1.2.0
  - Add new route for retrieving Log information
- 1.1.0
  - Add Job step details for new BilboMD Auto job type
  - update npm dependencies
- 1.0.1
  - Adjust admin route for new `v1` API
  - Adjust formidable maxFileSize
  - Some swagger config changes
- 1.0.0
  - Implement versioned API (start with `v1`)
  - Start out with a new major package version (`1.0.0`)
  - API will make best effort to conform to [OpenAPI 3.\*](https://swagger.io/specification/) specification.
  - Add [SwaggerUI](https://swagger.io/tools/swagger-ui/) for public facing API documentation.
- 0.0.14
  - Add AutoRg API endpoint that uses [BioXTAS RAW](https://github.com/jbhopkins/bioxtasraw) to calcualte `rg_min` and `rg_max`
- 0.0.13
  - Update the PAE Pythons script
- 0.0.12
  - Add number of Workers to the Backend BullMQ Controller
- 0.0.11
  - fix the bug where CHARMM fails when filenames have uppercase letters
- 0.0.10
  - Add BullMQ Summary routes
- 0.0.9
  - Improve Job Details page.
  - Add function to gather status for each BilboMD step.
  - Update all npm dependencies.
  - Remove the default `priority: 1` from the `defaultJobOptions` configuration.
- 0.0.8
  - Add new routes for PAE jiffy (creates const.inp from AlphaFold PAE JSON input file).
  - Dockerfile build was moved from bullseye to continuumio/miniconda3 to enable conda envs inside Docker container.
  - Add Michal's PAE script `write_const_from_pae.py` directly to this project.
  - Update all NPM dependencies as of 08/06/2023
- 0.0.7
  - baseline.
  - will start using [Semantic Versioning](https://semver.org/).
- 0.0.3
  - BullMQ queue system added.
- 0.0.2
  - Authentication and RBAC added.
- 0.0.1
  - Initial Release.

## Acknowledgments

Inspiration, code snippets, etc.

- [Dave Gray's MERN Stack Tutorial](https://youtube.com/playlist?list=PL0Zuz27SZ-6P4dQUsoDatjEGpmBpcOW8V)
- [Dave Gray's React Tutorial](https://youtube.com/playlist?list=PL0Zuz27SZ-6PrE9srvEn8nbhOOyxnWXfp)
- [bull-board](https://github.com/felixmosh/bull-board)

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[MongoDB]: https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white
[MongoDB-url]: https://www.mongodb.com/
[NodeJS]: https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white
[NodeJS-url]: https://nodejs.org/
[ExpressJS]: https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB
[ExpressJS-url]: https://expressjs.com/
[Redis]: https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white
[Redis-url]: https://redis.io/
[Docker]: https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white
[Docker-url]: https://www.docker.com/
[BullMQ]: ./public/BullMQ-logo-sm.png
[BullMQ-url]: https://docs.bullmq.io/
