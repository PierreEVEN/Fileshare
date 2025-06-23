#!Dockerfile

FROM alpine:latest

ARG VERSION=latest

RUN apk update
RUN apk add wget unzip dos2unix ffmpeg imagemagick
RUN mkdir /opt/fileshare
RUN mkdir /opt/fileshare/migrations

COPY scripts/config.json /opt/fileshare/
COPY scripts/download_run.sh /opt/fileshare/

RUN chmod u+x /opt/fileshare/download_run.sh
RUN dos2unix /opt/fileshare/download_run.sh

CMD /opt/fileshare/download_run.sh ${VERSION}