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
  if (!SLACK_BOT_TOKEN || !SLACK_SIGNING_SECRET) {
    console.log("WARNING! One or both of SLACK_BOT_TOKEN or SLACK_SIGNING_SECRET is not defined!");
  }
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

export { SLACK_BOT_TOKEN, isValidSlackRequest };
