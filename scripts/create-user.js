#!/usr/bin/env node
/**
 * create-user.js — Backstage user provisioning script
 *
 * Usage:
 *   node scripts/create-user.js --name "Jane Smith" --email jane@example.com --role admin
 *
 * Roles: super_admin | admin | performer
 *
 * The script will prompt for a password (input is hidden).
 * It checks that the email does not already exist in the Users table,
 * hashes the password with bcrypt (12 rounds), and creates the Airtable record.
 */

require("dotenv").config();

const readline = require("readline");
const bcrypt = require("bcryptjs");
const Airtable = require("airtable");

const USERS_TABLE = "tblUSRLRuXOiidVIG";
const VALID_ROLES = ["super_admin", "admin", "performer"];

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && args[i + 1]) {
      result[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return result;
}

// ── Readline helpers ──────────────────────────────────────────────────────────

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

/** Prompt for a password without echoing the input. */
function promptPassword(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write(question);

    // Hide input by writing nothing back
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    let password = "";

    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const onData = (char) => {
      if (char === "\n" || char === "\r" || char === "\u0004") {
        // Enter or EOF
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdout.write("\n");
        process.stdin.removeListener("data", onData);
        rl.close();
        resolve(password);
      } else if (char === "\u0003") {
        // Ctrl+C
        process.stdout.write("\n");
        process.exit(0);
      } else if (char === "\u007f" || char === "\b") {
        // Backspace
        password = password.slice(0, -1);
      } else {
        password += char;
      }
    };

    process.stdin.on("data", onData);
  });
}

// ── Airtable helpers ──────────────────────────────────────────────────────────

function getBase() {
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    console.error("Error: AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set in .env");
    process.exit(1);
  }
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID,
  );
}

async function emailExists(base, email) {
  return new Promise((resolve, reject) => {
    const found = [];
    base(USERS_TABLE)
      .select({
        filterByFormula: `LOWER({email}) = "${email.toLowerCase().replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
        maxRecords: 1,
        fields: ["email"],
      })
      .eachPage(
        (records, next) => { found.push(...records); next(); },
        (err) => { if (err) reject(err); else resolve(found.length > 0); },
      );
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  // Validate required args
  if (!args.name || !args.email || !args.role) {
    console.error("Usage: node scripts/create-user.js --name \"Full Name\" --email user@example.com --role admin");
    console.error("Roles: super_admin | admin | performer");
    process.exit(1);
  }

  const name = args.name.trim();
  const email = args.email.trim().toLowerCase();
  const role = args.role.trim();

  if (!VALID_ROLES.includes(role)) {
    console.error(`Invalid role "${role}". Must be one of: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(`Invalid email address: ${email}`);
    process.exit(1);
  }

  console.log(`\nCreating user: ${name} <${email}> [${role}]\n`);

  const password = await promptPassword("Password: ");
  const confirmPassword = await promptPassword("Confirm password: ");

  if (password !== confirmPassword) {
    console.error("\nPasswords do not match.");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("\nPassword must be at least 8 characters.");
    process.exit(1);
  }

  const base = getBase();

  console.log("\nChecking for existing user...");
  const exists = await emailExists(base, email);
  if (exists) {
    console.error(`A user with email "${email}" already exists.`);
    process.exit(1);
  }

  console.log("Hashing password...");
  const passwordHash = await bcrypt.hash(password, 12);

  console.log("Creating Airtable record...");
  const [record] = await base(USERS_TABLE).create([
    {
      fields: {
        email,
        name,
        role,
        passwordHash,
        active: true,
      },
    },
  ]);

  console.log(`\nUser created successfully!`);
  console.log(`  Airtable record ID: ${record.id}`);
  console.log(`  Name:  ${name}`);
  console.log(`  Email: ${email}`);
  console.log(`  Role:  ${role}`);
}

main().catch((err) => {
  console.error("Unexpected error:", err.message || err);
  process.exit(1);
});
