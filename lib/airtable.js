"use strict";

const Airtable = require("airtable");

/**
 * Return a configured Airtable Base instance.
 * Called at request time so env vars are always read after dotenv has loaded.
 */
function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID,
  );
}

module.exports = { getBase };
