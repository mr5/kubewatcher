FROM node:8.11.3-alpine

RUN apk add --no-cache tzdata

COPY . /opt/kubewatcher
WORKDIR /opt/kubewatcher
#RUN yarn install
RUN npm install
RUN npm run build
#RUN yarn install --production
RUN npm prune --production
EXPOSE 3000
CMD npm start
