import { Handlers } from "$fresh/server.ts";

// Handle Slack events we've subscribed to.
// TODO: Add support for 'url_verification' and 'app_mention' events.
export const handler: Handlers = {
  async POST(req) {
    let eventBody;
    try {
      eventBody = await req.json();
    } catch (err) {
      const headers = new Headers;
      headers.set("content-type", "application/json");
      const msg = { message: "Invalid input"};
      return new Response(
        JSON.stringify(msg),
        {
          headers: headers,
          status: 400
        }
      );
    }
    console.log(eventBody);
    return new Response(); // Simple 200 OK
  },
};
