export type ChatMessage = {
	id: string;
	content: string;
	user: string;
	role: "user" | "assistant";
	timestamp?: number;
};

export type Message =
	| {
			type: "add";
			id: string;
			content: string;
			user: string;
			role: "user" | "assistant";
			timestamp?: number;
	  }
	| {
			type: "update";
			id: string;
			content: string;
			user: string;
			role: "user" | "assistant";
			timestamp?: number;
	  }
	| {
			type: "delete";
			id: string;
	  }
	| {
			type: "all";
			messages: ChatMessage[];
	  }
	| {
			type: "clear";
	  };

export const names = [
	"Alice",
	"Bob",
	"Charlie",
	"David",
	"Eve",
	"Frank",
	"Grace",
	"Heidi",
	"Ivan",
	"Judy",
	"Kevin",
	"Linda",
	"Mallory",
	"Nancy",
	"Oscar",
	"Peggy",
	"Quentin",
	"Randy",
	"Steve",
	"Trent",
	"Ursula",
	"Victor",
	"Walter",
	"Xavier",
	"Yvonne",
	"Zoe",
];
