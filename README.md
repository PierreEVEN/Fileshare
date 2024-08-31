# Fileshare

Fileshare is a self-hosted cloud storage platform I developed in my spare time for my own personal use.

You can try it online here : [https://fileshare.evenpierre.fr](https://fileshare.evenpierre.fr)

> Note : this server application is available as-is. I have no plans to distribute it on a large scale at the moment.

<img src="/doc/img/pres-1.png" alt="drawing" width="100%"/>
<img src="/doc/img/pres-2.png" alt="drawing" width="49%"/>
<img src="/doc/img/pres-3.png" alt="drawing" width="50%"/>

## Features

- Browse, view and organize your file using the web client
- Unlimited file size (Unless the server has enough storage)
- Per user permission management
- Easily share your data and manage access for third-party contributors
- Advanced search filters
- Advanced media file processing (optimization, re-encoding...)

## Setup

- Install node and npm
- Install node modules : `npm install`
- Install postgresql
- set .env with database credentials and SSL files paths :
  - DATABASE_USER="postgres"
  - DATABASE_PASSWORD="yourpostgrespassword"
  - SESSION_SECRET="yoursessionsecret"
  - PORT="3000"
  - EMAIL_HOST=mail.server.com
  - EMAIL_PORT=465
  - EMAIL_AUTH=noreply@your-mail.com
  - EMAIL_PASSWD=YourEmailPassword
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
