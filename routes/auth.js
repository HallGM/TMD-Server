const express = require("express");
const bcrypt = require("bcryptjs");
const { requireAuth } = require("../middleware/auth");
const { getBase } = require("../lib/airtable");

const router = express.Router();

// ── Airtable ──────────────────────────────────────────────────────────────────

const USERS_TABLE = "tblUSRLRuXOiidVIG";

/** Fetch a single user record by email. Returns null if not found. */
async function findUserByEmail(email) {
  const base = getBase();
  return new Promise((resolve, reject) => {
    const results = [];
    base(USERS_TABLE)
      .select({
        filterByFormula: `LOWER({email}) = "${email.toLowerCase().replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
        maxRecords: 1,
      })
      .eachPage(
        (records, next) => {
          results.push(...records);
          next();
        },
        (err) => {
          if (err) return reject(err);
          if (results.length === 0) return resolve(null);
          const r = results[0];
          resolve({
            id: r.id,
            email: r.get("email") || "",
            name: r.get("name") || "",
            role: r.get("role") || "performer",
            passwordHash: r.get("passwordHash") || "",
            active: r.get("active") === true,
          });
        },
      );
  });
}

/** Update the passwordHash field for a user record. */
async function updatePasswordHash(recordId, hash) {
  const base = getBase();
  await base(USERS_TABLE).update(recordId, { passwordHash: hash });
}

// ── GET /login ────────────────────────────────────────────────────────────────

router.get("/login", (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect("/lyrics");
  }
  const error = req.query.error;
  let errorMsg = null;
  if (error === "deactivated") errorMsg = "Your account has been deactivated. Please contact an administrator.";
  if (error === "invalid") errorMsg = "Incorrect email or password.";
  res.render("login", { error: errorMsg, next: req.query.next || "/lyrics" });
});

// ── POST /login ───────────────────────────────────────────────────────────────

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const nextUrl = req.body.next || "/lyrics";

  if (!email || !password) {
    return res.render("login", {
      error: "Email and password are required.",
      next: nextUrl,
    });
  }

  try {
    const user = await findUserByEmail(email.trim());

    if (!user) {
      return res.render("login", { error: "Incorrect email or password.", next: nextUrl });
    }

    if (!user.active) {
      return res.render("login", {
        error: "Your account has been deactivated. Please contact an administrator.",
        next: nextUrl,
      });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.render("login", { error: "Incorrect email or password.", next: nextUrl });
    }

    // Regenerate session to prevent fixation
    req.session.regenerate((err) => {
      if (err) {
        console.error("Session regeneration error:", err);
        return res.render("login", { error: "Login failed. Please try again.", next: nextUrl });
      }
      req.session.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        active: user.active,
      };
      // Validate the redirect target is a relative URL (no open redirect).
      // We parse it against a dummy base: if the resulting origin differs from
      // the dummy base, it means the URL is absolute / protocol-relative and
      // must be rejected.
      let safe = "/lyrics";
      try {
        const parsed = new URL(nextUrl, "http://n");
        if (parsed.origin === "http://n") safe = nextUrl;
      } catch {
        // unparseable — fall back to default
      }

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Session save error:", saveErr);
          return res.render("login", { error: "Login failed. Please try again.", next: nextUrl });
        }
        res.redirect(safe);
      });
    });
  } catch (err) {
    console.error("Login error:", err);
    res.render("login", { error: "Login failed. Please try again.", next: nextUrl });
  }
});

// ── POST /logout ──────────────────────────────────────────────────────────────

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// ── GET /account ──────────────────────────────────────────────────────────────

router.get(
  "/account",
  requireAuth(["super_admin", "admin", "performer"]),
  (req, res) => {
    res.render("account", { success: null, error: null });
  },
);

// ── POST /account/password ────────────────────────────────────────────────────

router.post(
  "/account/password",
  requireAuth(["super_admin", "admin", "performer"]),
  async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.render("account", { error: "All fields are required.", success: null });
    }

    if (newPassword !== confirmPassword) {
      return res.render("account", { error: "New passwords do not match.", success: null });
    }

    if (newPassword.length < 8) {
      return res.render("account", {
        error: "New password must be at least 8 characters.",
        success: null,
      });
    }

    try {
      const user = await findUserByEmail(req.session.user.email);
      if (!user) {
        return res.render("account", { error: "User not found.", success: null });
      }

      const match = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!match) {
        return res.render("account", { error: "Current password is incorrect.", success: null });
      }

      const hash = await bcrypt.hash(newPassword, 12);
      await updatePasswordHash(user.id, hash);

      res.render("account", { success: "Password updated successfully.", error: null });
    } catch (err) {
      console.error("Password change error:", err);
      res.render("account", { error: "Failed to update password. Please try again.", success: null });
    }
  },
);

module.exports = router;
