import { Handlers } from "$fresh/server.ts";
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") || "";
const SLACK_SIGNING_SECRET = Deno.env.get("SLACK_SIGNING_SECRET") || "";

// Given a Slack request timestamp (seconds since epoch; no milliseconds),
// determine if it is too old (>= 5 min from "now").
// This protects against potential replay attacks.
const old = (timestamp: string): boolean => {
  const now = Math.floor(Date.now() / 1000); // No millis, vanilli.
  const splay = Math.abs(now - parseInt(timestamp));
  return splay >= 300; // 5 minutes;
};

// https://api.slack.com/authentication/verifying-requests-from-slack
const isValidSlackRequest = (body, headers: Headers): boolean => {
  const bodyAsString = JSON.stringify(body);
  const timestamp = headers.get("x-slack-request-timestamp");
  const slackSignature = headers.get("x-slack-signature");
  if (!timestamp || !slackSignature) {
    console.log("Missing one or more expected Slack HTTP headers");
    return false;
  }
  if (old(timestamp)) {
    return false;
  }

  const [slackHashVersion, slackHash] = slackSignature.split("=");
  const baseString = `${slackHashVersion}:${timestamp}:${bodyAsString}`
  const calculatedHash = hmac("sha256", SLACK_SIGNING_SECRET, baseString, "utf8", "hex");
  if (calculatedHash == slackHash) {
    return true;
  }

  return false; // Sane default.
};

// Common response headers we'll use often.
const baseResponseHeaders = new Headers;
baseResponseHeaders.set("content-type", "application/json");

// Handle Slack events we've subscribed to.
export const handler: Handlers = {
  async POST(req) {
    if (!SLACK_BOT_TOKEN || !SLACK_SIGNING_SECRET) {
      console.log("WARNING! One or both of SLACK_BOT_TOKEN or SLACK_SIGNING_SECRET is not defined!");
    }
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
