import { Handlers } from "$fresh/server.ts";
import { SLACK_BOT_TOKEN, isValidSlackRequest } from "../../utils/validation.ts";

// Common response headers we'll use often.
const baseResponseHeaders = new Headers;
baseResponseHeaders.set("content-type", "application/json");

// Handle Slack events we've subscribed to.
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
          headers: baseResponseHeaders,
          status: 400
        }
      );
    }

    if (!isValidSlackRequest(eventBody, req.headers)) {
      console.log("Malformed or malicious event!");
      const msg = { message: "Invalid or malformed input" };
      return new Response(
        JSON.stringify(msg),
        {
          headers: baseResponseHeaders,
          status: 400
        }
      );
    }

    // Verify a Slack challenge. We'll see these when initially setting up
    // the Slack app.
    // https://api.slack.com/apis/connections/events-api#challenge
    switch (eventBody.type) {
      case "url_verification":
        const headers = new Headers;
        headers.set("content-type", "application/json");
        const msg = { challenge: eventBody.challenge };
        return new Response(
          JSON.stringify(msg),
          {
            headers: baseResponseHeaders,
            status: 200
          }
        );

      case "event_callback":
        const { type } = eventBody.event;
        if (type == "app_mention") {
          const headers = new Headers(baseResponseHeaders);
          headers.set("authorization", `Bearer ${SLACK_BOT_TOKEN}`);
          const { text, user, channel } = eventBody.event;
          // We likely need an expression to match the bot's ID explicitly so
          // that we can filter it out and avoid an app_mention loop condition.
          const re = /(?<user_id>^<.+>\s)(?<user_message>.+$)/;
          const match = text.match(re);
          // TODO: If the message doesn't match this expression, let's reply
          // with a help message illustrating how we work.
          const msg = {
            channel: channel,
            text: `<@${user}> said: ${match.groups.user_message}`
          };
          const slackResp = await fetch("https://slack.com/api/chat.postMessage",
            {
              headers: headers,
              method: "POST",
              body: JSON.stringify(msg)
            }
          );
          // TODO: Test slackResp for ok-ness.
        }
        // Reply 200 OK all the time.
        return new Response(
          JSON.stringify(""),
          {
            status: 200
          }
        );

      default:
        console.log("Unknown/unexpected Slack event type.");
        const unexpected = { message: "Unexpected event type" };
        return new Response(
          JSON.stringify(unexpected),
          {
            headers: baseResponseHeaders,
            status: 400
          }
        );
    }
    return new Response(); // Simple 200 OK
  },
};
