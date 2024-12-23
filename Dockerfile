# Use an official Node.js runtime as the base image
FROM node:16-alpine

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build the Next.js app
RUN npm run build

# Expose the port that your Next.js app runs on
EXPOSE 8080

# Start the app
CMD ["npm", "start"]
