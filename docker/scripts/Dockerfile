#!Dockerfile

FROM alpine:3.21

ARG VERSION=latest

RUN apk update
RUN apk add wget unzip dos2unix ffmpeg imagemagick libraw blender vtk assimp alembic xvfb mesa-gles mesa-osmesa mesa-dri-gallium py3-numpy ghostscript
RUN mkdir /opt/fileshare
RUN mkdir /opt/fileshare/migrations

COPY scripts/config.json /opt/fileshare/
COPY scripts/download_run.sh /opt/fileshare/

RUN chmod u+x /opt/fileshare/download_run.sh
RUN dos2unix /opt/fileshare/download_run.sh
RUN ln -s /usr/lib/libOSMesa.so.8 /usr/lib/libOSMesa.so

CMD /opt/fileshare/download_run.sh ${VERSION}