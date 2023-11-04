# Use the official Node.js image as the base image
FROM node:20

# Create a working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of your application code to the container
COPY . .

# Expose the port your app is listening on
EXPOSE 3001

# Command to start your Node.js application
CMD ["node", "index.js"]
