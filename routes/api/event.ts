import { Handlers } from "$fresh/server.ts";
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

// TODO: Read this from an env var.
const botToken = "xoxb-2174126344-5225423913652-2Grd4b7Y1WR9TjKKfa5hwQ8V";

const isValidSlackEvent = (body, headers): boolean => {
  // Let's start sniffing out the X-Slack-Signature header.
  console.log(headers);
  console.log(body);
  const bodyAsString = body.toString();
  const timestamp = headers.get("x-slack-request-timestamp");
  const slackSignature = headers.get("x-slack-signature");
  if (!timestamp || !slackSignature) {
    console.log("Missing one or more expected Slack HTTP headers");
    return false;
  }
  const [slackHashVersion, slackHash] = slackSignature.split("=");
  // TODO: Verify the timestamp is < 5 min old.
  // FIXME: Grab this from the environment.
  const signingSecret = "43c891e7a822a9f3a2055e7367ac3c51";
  const baseString = `${slackHashVersion}:${timestamp}:${bodyAsString}`
  calculatedHash = hmac("sha256", signingSecret, baseString, "utf8", "hex");
  console.log(calculatedHash);
};

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
    isValidSlackEvent(eventBody, req,headers);
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
            headers: headers,
            status: 200
          }
        );
        break;
      case "event_callback":
        const { type } = eventBody.event;
        if (type == "app_mention") {
          const headers = new Headers;
          headers.set("content-type", "application/json");
          headers.set("authorization", `Bearer ${botToken}`);
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
          console.log(slackResp);
          // TODO: Test slackResp for ok-ness.
        }
        // Reply 200 OK all the time.
        return new Response(
          JSON.stringify(""),
          {
            status: 200
          }
        );
        break;
      default:
        console.log("Unknown/unexpected Slack event type.");
    }
    return new Response(); // Simple 200 OK
  },
};
