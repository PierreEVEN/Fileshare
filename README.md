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
