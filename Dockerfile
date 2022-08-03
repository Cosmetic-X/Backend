# Pull nodejs
FROM node:18

# Copy application files
COPY . .

# Install npm packages
RUN npm install

# Start the application
CMD ["npm", "start"]
