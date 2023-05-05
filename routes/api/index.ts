import { Handlers } from "$fresh/server.ts";

// This route exists because it feels right for nodes in a tree to return
// a positive response.
export const handler: Handlers = {
  async GET() {
    return new Response(); // Simple 200 OK
  },
};
