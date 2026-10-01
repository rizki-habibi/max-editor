FROM node:20-alpine AS build
WORKDIR /app

# Railway menyediakan service variables pada build, tetapi Dockerfile
# harus mendeklarasikan ARG agar Vite dapat membacanya saat npm run build.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_RUNWAY_BRIDGE_URL

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_RUNWAY_BRIDGE_URL=$VITE_RUNWAY_BRIDGE_URL

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx","-g","daemon off;"]
