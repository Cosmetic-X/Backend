# Pull nodejs
FROM node:17.5.0

# Copy application files
COPY . .

# Start the application
CMD ["npm", "start"]