const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 4173;
const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function buildRecommendationHtml(rec) {
  const best = rec.bestMatch;
  const alts = rec.alternatives || [];
  return `
    <h2>Your plant recommendation is ready 🌱</h2>
    <p><strong>Best Match:</strong> ${best.name}</p>
    <p><strong>Care:</strong> ${best.care}</p>
    <p><strong>Alternatives:</strong> ${alts.map((a) => a.name).join(", ") || "None"}</p>
    <p>Open Plant Match Studio anytime to retake and refine your preferences.</p>
  `;
}

async function upsertMailchimpAudienceMember({ name, email, recommendation }) {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX;
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;

  if (!apiKey || !serverPrefix || !audienceId) {
    throw new Error("Mailchimp audience env vars missing. Set MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, MAILCHIMP_AUDIENCE_ID.");
  }

  const subscriberHash = sha256(email.toLowerCase());
  const endpoint = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${audienceId}/members/${subscriberHash}`;
  const mergeFields = {
    FNAME: name,
    BPLANT: recommendation.bestMatch.name,
    BTYPE: recommendation.bestMatch.type,
  };

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Authorization: `apikey ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: email,
      status_if_new: "subscribed",
      status: "subscribed",
      merge_fields: mergeFields,
      tags: ["plant-recommendation"],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Mailchimp audience error: ${errBody}`);
  }
}

async function sendTransactionalEmail({ name, email, recommendation }) {
  const transactionalKey = process.env.MAILCHIMP_TRANSACTIONAL_API_KEY;
  const fromEmail = process.env.MAIL_FROM_EMAIL || "no-reply@plantmatch.local";
  const fromName = process.env.MAIL_FROM_NAME || "Plant Match Studio";

  if (!transactionalKey) {
    return false;
  }

  const response = await fetch("https://mandrillapp.com/api/1.0/messages/send.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: transactionalKey,
      message: {
        from_email: fromEmail,
        from_name: fromName,
        to: [{ email, name, type: "to" }],
        subject: `Your best plant match: ${recommendation.bestMatch.name}`,
        html: buildRecommendationHtml(recommendation),
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Mailchimp transactional error: ${errBody}`);
  }

  return true;
}

function serveStatic(req, res) {
  const requestPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(ROOT, decodeURIComponent(requestPath));

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[extension] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/subscribe") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
      }
    });

    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body || "{}");
        const { name, email, recommendation } = parsed;

        if (!name || !email || !recommendation?.bestMatch?.name) {
          sendJson(res, 400, { error: "Invalid payload. Name, email, and recommendation are required." });
          return;
        }

        await upsertMailchimpAudienceMember({ name, email, recommendation });
        const sent = await sendTransactionalEmail({ name, email, recommendation });

        sendJson(res, 200, {
          ok: true,
          message: sent
            ? "You are subscribed and your recommendation email has been sent."
            : "You are subscribed to Mailchimp. Add MAILCHIMP_TRANSACTIONAL_API_KEY to send recommendation emails automatically.",
        });
      } catch (error) {
        sendJson(res, 500, { error: error.message || "Mailchimp integration failed." });
      }
    });
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
});

server.listen(PORT, () => {
  console.log(`Plant Match Studio running on http://0.0.0.0:${PORT}`);
});
