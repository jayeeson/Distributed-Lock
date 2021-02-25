<!-- ABOUT THE PROJECT -->

## About The Project

I made a distributed lock that can be used by other services. It solves data-setting race issues. I mostly made it as an exercise in TDD.

### Built With

- [Typescript](https://www.typescriptlang.org/)
- [Node](https://nodejs.org/en/)
- [Express](https://expressjs.com/)
- [Redis](https://redis.io/)

<!-- GETTING STARTED -->

## Getting Started

```sh
yarn install
```

## Usage

### Prerequisites

- yarn
- redis

### How to run

```
yarn start
```

#### **config**

Configure by creating a .env file in the root directory with the following keys:

- `PORT` - port on which to launch this node app. Default is `3000`
- `HOST` - hostname. Default is `localhost`
- `REDIS_PORT` - redis port. Default is `6379`
- `REDIS_HOST` - Redis host. Default is `localhost`
- `DEFAULT_EXPIRY` - Default expiry time. Default is 1 second.

Alternatively, command line options can be specified:

```
-p     --port <value>           specify launch port
-H     --host <value>           specify launch host
-P     --redis-port <value>     specify redis port
-R     --redis-host <string>    specify redis host
-N     --no-redis               use in-memory key repository instead of redis
-E     --default-expiry <ms>    set default lock duration expiry time (ms)
```

The no redis option uses an in-memory repository instead of redis.

Program will keep track of locked keys identified by a uid string. Other services can access its API:  
| Method | Path | Input | Description | Output |
| ------ | ---- | ----- | ----------- | ------ |
| POST | `/lock` | uid: `string` - unique id of service making API call<br>keys: `string \| string[]` - keys to lock<br>exp?: `number` (optional) - length of lock (ms). Equals default if not specified. | Service locks specified keys either until it is unlocked or after expiry. | response is JSON containing either:<br>`error`<br>or<br>`tokens:{`<br>&nbsp;&nbsp;`key`,<br>&nbsp;&nbsp;`version`<br>`}[]` |
| POST | `/unlock` | uid: `string`<br>tokens: `{key: string, version: number}[]` - keys to lock - should use the `tokens` response of the lock object. | Unlock the tokens by including the tokens received when they were locked. | `unlocked`: string - keys that have been unlocked. |
| POST | `/check` | keys: `string \| string []` | Checks whether all specified keys are locked | locked: `boolean` - true if at least 1 key is locked

<!-- ROADMAP -->

## License

Distributed under the GPLv3 License. See `LICENSE` for more information.
