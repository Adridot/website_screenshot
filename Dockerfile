# Use the official Node.js image as the base image
FROM node:20

RUN apt-get update && apt-get install -y  \
    ca-certificates  \
    fonts-liberation  \
    libappindicator3-1  \
    libasound2  \
    libatk-bridge2.0-0  \
    libatk1.0-0  \
    libc6  \
    libcairo2  \
    libcups2  \
    libdbus-1-3  \
    libexpat1  \
    libfontconfig1  \
    libgbm1  \
    libgcc1  \
    libglib2.0-0  \
    libgtk-3-0  \
    libnspr4  \
    libnss3  \
    libpango-1.0-0  \
    libpangocairo-1.0-0  \
    libstdc++6  \
    libx11-6  \
    libx11-xcb1  \
    libxcb1  \
    libxcomposite1  \
    libxcursor1  \
    libxdamage1  \
    libxext6  \
    libxfixes3  \
    libxi6  \
    libxrandr2  \
    libxrender1  \
    libxss1  \
    libxtst6  \
    lsb-release  \
    wget  \
    xdg-utils


# Create a working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json /app

# Install project dependencies
RUN npm install

# Copy the rest of your application code to the container
COPY . /app

# Expose the port your app is listening on
EXPOSE 3001

# Command to start your Node.js application
CMD ["node", "index.js"]
