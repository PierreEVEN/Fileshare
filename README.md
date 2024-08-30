# Fileshare

This is the public git repos of a cloud application available at [https://fileshare.evenpierre.fr](https://fileshare.evenpierre.fr)

## Setup

- Install node and npm
- Install node modules : `npm install`
- Install mysql with a database named 'Fileshare'
- set env with database credentials and SSL files paths :
  - DATABASE_USER : Database username,
  - DATABASE_PASSWORD : Database password,
  - SESSION_SECRET : Express session secret,
  - PORT : custom port (default : 80 or 443),
  - SSL_CERTIFICATE : SSL certificate file path,
  - SSL_PRIVATE_KEY : SSL private key file path,
  - SSL_CHAIN : SSL chain file path
- Run server in development mode `npm run dev` or production mode `npm run prod`

That's it !

## Permissions

You can always delete what you created !
Deleting an account also delete everything you added (repos, files and directories)

There is 3 permission types :

- view : browse and download the resource
- upload : upload data inside this object
- edit : modify object and delete data inside

### Fileshare user role : 'guest', 'vip', 'admin'

By default, new user are 'guest'.

- guest can view and download visible repos contents, they can also upload to repos giving them the upload permission.
- vip have the same rights and can create repos and upload to it.
- admins can view every repo (not the content) and delete it. They can also manage users (give vip roles / bans etc...)

### Repos specific user roles : 'read-only', 'contributor', 'moderator'

By default, when you add a user to a repos, it has the 'read-only' rights.

- read-only can see and download repos contents
- contributors can also upload data (including in other people's directory)
- moderator can also delete files and directories (including in other people's directory)

Note: Only moderators can open a directory to upload

### Custom directory attributes : open_upload

- When open_upload is set to true, every connected user that have read access to the repo can upload files to this directory
- if a user create a directory inside it, it becomes private to him.

When someone create a ressource inside a directory, it automatically has the 'contributor permissions' on it.

## API


### GET/time-epoch

Get server time since epoch.
- **return :** Time since epoch in milliseconds

```json
{
  "time_since_epoch": "1234567890"
}
```

### POST/auth/gen-token

Generate an auth token.
- **content:** Auth credentials as json data

```json
{
  "login":"username",
  "password": "passwdhash"
}
```

- **return :** Auth token (401 if credentials are not valid)

```json
{
  "token": "token",
  // expiration timestamp 
  "expiration-date": 1234567890
}
```

### GET/repos/tree?repos=<repos_id>

Get repository tree. 
- **Option** : 
  - &directory=<directory_path>
  - &auth-token=<auth-token>

- **return :** Directory tree as json data

```json
{
  "directories": [
    {
      "name": "directory",
      "directories": [
        ...
      ],
      "files": [
        ...
      ]
    }
  ],
  "files": [
    {
      "name": "file.ext",
      // size in bytes
      "size": 1456,
      // last modification timestamp
      "time": 1234567890
    }
  ]
}
```


### GET/repos/file?path=<path/to/file/uri>

Download file from path uri

- **Option** :
  - &directory=<directory_path>
  - &auth-token=<auth-token>

- **return :** File stream

## Upload process

1) Send metadata in headers with expected size and hash to initiate the file transfer. Also send the first packet
2) The server respond with the exchange-token and status=201 if the received size is less than the total file size
3) Send file by packets of n octets (depending on the client settings) with the exchange-token in headers
4) The server will respond status=200 while the file is not complete
5) When the file is complete, the server respond with status=202

### POST/repos/upload/file?repos=<repos>

Metadata header : 
```
transfert_token:  Content-Token
name:             Content-Name,
size:             Content-Size,
mimetype:         Content-Mimetype,
path:             Content-Path,
description:      Content-Description,
timestamp:        Content-Timestamp
```

