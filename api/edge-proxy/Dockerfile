# EDGE hub reverse proxy — nginx with the LAN /res/* routing baked in, so the
# hub installer stays "download compose + pull images + run" with no extra files.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
