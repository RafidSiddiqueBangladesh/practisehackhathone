# Express API

Simple library member API built with Node.js and Express.

## Run with Docker
```bash
docker compose up --build
```

## Run locally
```bash
npm install
npm start
```

## API Endpoints

- `POST /api/members` - Create a new member

## Example Request
```bash
curl -X POST http://localhost:8000/api/members \
  -H "Content-Type: application/json" \
  -d '{"member_id": 1, "name": "Alice", "age": 22}'
```
