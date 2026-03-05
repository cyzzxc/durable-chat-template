# Durable Chat App

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/durable-chat-template)

![Template Preview](https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/da00d330-9a3b-40a2-e6df-b08813fb7200/public)

<!-- dash-content-start -->

A real-time chat application built on Cloudflare Workers with Durable Objects, using the PartyServer API for simplified WebSocket management.

## Features

- Real-time WebSocket communication
- Persistent message storage via Durable Object SQL
- HTTP REST API for programmatic access
- Multiple isolated chat rooms by URL path

## How It Works

Users are assigned their own chat room when they first visit the page, and can talk to others by sharing their room URL. When someone joins the chat room, a WebSocket connection is opened with a Durable Object that stores and synchronizes the chat history.

The Durable Object instance manages all WebSocket connections and provides HTTP API endpoints. Messages are stored using the Durable Object SQL Storage API.

<!-- dash-content-end -->

## Getting Started

```bash
# Create a new project
npm create cloudflare@latest -- --template=cloudflare/templates/durable-chat-template

# Install dependencies
npm install

# Start local development server
npm run dev

# Deploy to Cloudflare Workers
npm run deploy
```

## Architecture

### Server (`src/server/index.ts`)

The `Chat` class extends PartyServer's `Server` and handles:

- **WebSocket**: Real-time message broadcast to all connected clients
- **HTTP API**: REST endpoints for message operations
- **Persistence**: SQL storage for chat history

### Client (`src/client/index.tsx`)

React SPA using `partysocket/react` for WebSocket connections with React Router handling room-based routing (`/:room`).

### Shared Types (`src/shared.ts`)

- `ChatMessage`: `{ id, user, role, content }`
- `Message`: Union type for WebSocket messages (add/update/delete/all/clear)

## API Reference

### WebSocket

Connect to `wss://your-worker.workers.dev/parties/chat/{room}` and send JSON messages:

| Type | Payload |
|------|---------|
| `add` | `{ type: "add", id, content, user, role }` |
| `update` | `{ type: "update", id, content, user, role }` |
| `delete` | `{ type: "delete", id }` |
| `clear` | `{ type: "clear" }` |

### HTTP REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/parties/chat/{room}/messages` | Get all messages in room |
| `POST` | `/parties/chat/{room}/messages` | Create a new message |

**POST Request Body:**

```json
{
  "content": "Hello world",
  "user": "Alice",
  "role": "user"
}
```

**POST Response:**

```json
{
  "id": "uuid",
  "content": "Hello world",
  "user": "Alice",
  "role": "user"
}
```

## Development

```bash
npm run dev        # Start local development server
npm run deploy     # Deploy to Cloudflare Workers
npm run check      # Type-check client & server
```