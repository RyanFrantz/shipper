import { Handlers } from "$fresh/server.ts";

// TODO: Read this from an env var.
const botToken = "token: xoxb-2174126344-5225423913652-2Grd4b7Y1WR9TjKKfa5hwQ8V";

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
