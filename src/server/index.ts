import {
	type Connection,
	Server,
	type WSMessage,
	routePartykitRequest,
} from "partyserver";

import type { ChatMessage, Message } from "../shared";

export class Chat extends Server<Env> {
	static options = { hibernate: true };

	messages = [] as ChatMessage[];

	broadcastMessage(message: Message, exclude?: string[]) {
		this.broadcast(JSON.stringify(message), exclude);
	}

	onStart() {
		// this is where you can initialize things that need to be done before the server starts
		// for example, load previous messages from a database or a service

		// create the messages table if it doesn't exist
		this.ctx.storage.sql.exec(
			`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user TEXT, role TEXT, content TEXT)`,
		);

		// load the messages from the database
		this.messages = this.ctx.storage.sql
			.exec(`SELECT * FROM messages`)
			.toArray() as ChatMessage[];
	}

	onConnect(connection: Connection) {
		connection.send(
			JSON.stringify({
				type: "all",
				messages: this.messages,
			} satisfies Message),
		);
	}

	saveMessage(message: ChatMessage) {
		// check if the message already exists
		const existingMessage = this.messages.find((m) => m.id === message.id);
		if (existingMessage) {
			this.messages = this.messages.map((m) => {
				if (m.id === message.id) {
					return message;
				}
				return m;
			});
		} else {
			this.messages.push(message);
		}

		this.ctx.storage.sql.exec(
			`INSERT INTO messages (id, user, role, content) VALUES ('${
				message.id
			}', '${message.user}', '${message.role}', ${JSON.stringify(
				message.content,
			)}) ON CONFLICT (id) DO UPDATE SET content = ${JSON.stringify(
				message.content,
			)}`,
		);
	}

	deleteMessage(id: string) {
		this.messages = this.messages.filter((m) => m.id !== id);
		this.ctx.storage.sql.exec(`DELETE FROM messages WHERE id = '${id}'`);
	}

	onMessage(connection: Connection, message: WSMessage) {
		// let's broadcast the raw message to everyone else
		this.broadcast(message);

		// let's update our local messages store
		const parsed = JSON.parse(message as string) as Message;
		if (parsed.type === "add" || parsed.type === "update") {
			this.saveMessage(parsed);
		} else if (parsed.type === "delete") {
			this.deleteMessage(parsed.id);
		} else if (parsed.type === "clear") {
			this.clearMessages();
		}
	}

	clearMessages() {
		this.messages = [];
		this.ctx.storage.sql.exec(`DELETE FROM messages`);
	}

	async onRequest(request: Request) {
		const url = new URL(request.url);

		// Only handle /messages endpoint
		if (!url.pathname.endsWith("/messages")) {
			return new Response("Not Found", { status: 404 });
		}

		// GET /messages - 获取所有消息
		if (request.method === "GET") {
			return new Response(JSON.stringify(this.messages), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		// POST /messages - 发送新消息
		if (request.method === "POST") {
			try {
				const payload = (await request.json()) as Omit<
					ChatMessage,
					"id"
				>;

				// Generate a unique ID for the message
				const id = crypto.randomUUID();
				const message: ChatMessage = {
					id,
					...payload,
				};

				// Save and broadcast the message
				this.saveMessage(message);
				this.broadcastMessage({
					type: "add",
					...message,
				});

				return new Response(JSON.stringify(message), {
					status: 201,
					headers: { "Content-Type": "application/json" },
				});
			} catch (error) {
				return new Response(
					JSON.stringify({ error: "Invalid request body" }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
		}

		return new Response("Method Not Allowed", { status: 405 });
	}
}

export default {
	async fetch(request, env) {
		return (
			(await routePartykitRequest(request, { ...env })) ||
			env.ASSETS.fetch(request)
		);
	},
} satisfies ExportedHandler<Env>;
