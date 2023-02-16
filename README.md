# bilbomd-backend

Provides backend support for bilbomd-ui

## Description

`bilbomd-backend` provides authentication and authorization functionality for the bilbomd-ui front end application. It also provides several API functionalities for authentication, user creation/editting, and BilboMD job creation. The `bilbomd-backend` also provides an interface to MongoDB which provides a persistant store for User and Job records. The `bilbomd-backend` server also mediates the addition of BilboMD jobs to teh BullMQ queueing system and teh processing of Jobs for the queue using a Worker.

## Getting Started

### Dependencies

* [![NodeJS][NodeJS]][NodeJS-url]
* [![MongoDB][MongoDB]][MongoDB-url]
* [![ExpressJS][ExpressJS]][ExpressJS-url]
* [![Docker][Docker]][Docker-url]
* [![Redis][Redis]][Redis-url]
* [BullMQ][BullMQ-url]




### Installing

`bilbomd-backend` is most easily installed via docker compose as a docker container along side the redis and mongodb containers. You will also need to create an `.env` file with all the secret stuff in it. You can use `.env_example` as a starting point.

I guess you should probably start by cloning this repo.

```
cd /wherever/this/will/live
git clone https://github.com/bl1231/bilbomd-backend
```

You can install the Node.js dependencies for testing purposes, but keep in mind that these will be installed inside the Docker container when you run `docker compose build`. 

```
npm install
```


### Executing program

* Build the docker images

```
docker compose build
```
 * Fire them bad boys up interactively

 ```
 docker compose up
 ```

or in the background

```
docker compose up -d
```

## Authors

Contributors names and contact info

Scott Classen [@scott_classen](https://twitter.com/scott_classen)


## Version History

* 0.0.3
    * BullMQ queue system added
* 0.0.2
    * Authentication and RBAC added
* 0.0.1
    * Initial Release

## License

This project is licensed under the [NAME HERE] License - see the LICENSE.md file for details

## Acknowledgments

Inspiration, code snippets, etc.
* [Dave Gray's MERN Stack Tutorial](https://youtube.com/playlist?list=PL0Zuz27SZ-6P4dQUsoDatjEGpmBpcOW8V)
* [Dave Gray's React Tutorial](https://youtube.com/playlist?list=PL0Zuz27SZ-6PrE9srvEn8nbhOOyxnWXfp)
* [bull-board](https://github.com/felixmosh/bull-board)



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
[BullMQ-url]: https://docs.bullmq.io/