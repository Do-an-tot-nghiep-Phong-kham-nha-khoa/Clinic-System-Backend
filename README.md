# Dental Clinic Backend

## Run with Docker

### Using docker-compose (recommended)
1. Create a `.env` file (optional if using compose defaults):
   - MONGO_URL is set in docker-compose to the internal Mongo service.
2. Start services:
   - docker compose up -d
3. API available at http://localhost:3000
4. MongoDB available at mongodb://localhost:27017

### Build and run manually
- Build image:
  - docker build -t clinic-api .
- Run Mongo:
  - docker run -d --name clinic-mongo -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=root -e MONGO_INITDB_ROOT_PASSWORD=example -v mongo_data:/data/db mongo:6
- Run API:
  - docker run -d --name clinic-api --link clinic-mongo -p 3000:3000 -e MONGO_URL="mongodb://root:example@clinic-mongo:27017/clinic?authSource=admin" clinic-api

### Notes
- Change default credentials in `docker-compose.yml` for production.
- Data is persisted in the `mongo_data` Docker volume.