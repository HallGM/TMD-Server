require("dotenv").config();

// ── Startup guards ────────────────────────────────────────────────────────────
// Fail immediately in production if critical secrets are missing.

if (!process.env.SESSION_SECRET) {
  console.error("FATAL: SESSION_SECRET environment variable is not set. Refusing to start.");
  process.exit(1);
}

const express = require("express");
const session = require("express-session");
const MemoryStore = require("memorystore")(session);
const path = require("path");

const authRouter   = require("./routes/auth");
const lyricsRouter = require("./routes/lyrics");
const mapRouter    = require("./routes/map");

const app = express();

// Render terminates HTTPS at the proxy. Trust the first proxy hop so
// express-session can set secure cookies correctly in production.
app.set("trust proxy", 1);

// ── Request parsing ───────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ── View engine ───────────────────────────────────────────────────────────────

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ── Sessions ──────────────────────────────────────────────────────────────────
// memorystore is a production-safe in-process session store with LRU eviction.
// Sessions are lost on dyno restart — acceptable for an internal tool.

app.use(
  session({
    store: new MemoryStore({
      checkPeriod: 86_400_000, // prune expired entries every 24h
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
);

// ── Global locals ─────────────────────────────────────────────────────────────
// Makes user and mapboxToken available in all EJS views without explicit passing.

app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.mapboxToken = process.env.MAPBOX_TOKEN || "";
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Lightweight health endpoint for uptime checks / keep-alive pings
app.get("/healthz", (req, res) => {
  res.status(204).end();
});

// Redirect root to /lyrics (auth middleware on that route handles unauthenticated users)
app.get("/", (req, res) => res.redirect("/lyrics"));

app.use(authRouter);
app.use(lyricsRouter);
app.use(mapRouter);

// Redirect legacy favicon.ico requests to the SVG version
app.get("/favicon.ico", (req, res) => res.redirect(301, "/favicon.svg"));

// ── 404 handler ───────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).render("error", {
    title: "Page not found",
    message: "The page you're looking for doesn't exist.",
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backstage running on http://localhost:${PORT}`);

  // Keep the Render instance warm by self-pinging a lightweight endpoint.
  if (process.env.RENDER_EXTERNAL_URL) {
    setInterval(
      () => {
        fetch(`${process.env.RENDER_EXTERNAL_URL}/healthz`).catch((err) =>
          console.error("Keep-alive ping failed:", err),
        );
      },
      14 * 60 * 1000,
    );
  }
});
