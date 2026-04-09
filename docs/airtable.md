# Airtable Reference

## Overview

**Base ID:** `appjsWk7wKZvF80Gm`

All API calls are authenticated with a personal access token passed as a
bearer token in the `Authorization` header:

```
Authorization: Bearer <AIRTABLE_API_KEY>
```

The Node.js app uses the `airtable` npm package, which handles authentication
automatically when initialised with `apiKey: process.env.AIRTABLE_API_KEY`.

Both table IDs and field IDs are used in code (rather than names) so that
renaming a field or table in Airtable does not break the application.

---

## Tables

### Performers

**Purpose:** One record per band member. Used to populate the performer
selector in the lyrics rehearsal tool and to identify per-performer mistake
and notes columns in the Lyrics table.

**Table ID:** `tblDLB60lKGmK9Lv5`

| Field Name | Field ID | Type | Description | Example |
|---|---|---|---|---|
| performer | *(primary field)* | Single line text | Short initials / identifier used as a column prefix in Lyrics | `"GH"` |
| Name | *(auto)* | Formula / text | Display name derived from the record | `"Garry Hall"` |

> Note: The app reads only the `performer` (initials) and `Name` fields via
> `GET /api/performers`. Additional fields may exist in the base but are not
> used by this application.

---

### Medleys

**Purpose:** One record per medley / song set. Used to group Lyrics records
and to populate the medley selector in the lyrics rehearsal tool.

**Table ID:** `tblOfE65slr7lFwxk`

| Field Name | Field ID | Type | Description | Example |
|---|---|---|---|---|
| Name | *(primary field)* | Single line text | Display name of the medley | `"Beatles Mix"` |

> Note: The app reads only the `Name` field via `GET /api/medleys`.

---

### Lyrics

**Purpose:** One record per lyric line. Each record belongs to one or more
Medleys and carries per-performer mistake tracking columns.

**Table ID:** `tblzrwnA7rhVDF0Yd`

#### Core fields

| Field Name | Field ID | Type | Description | Example |
|---|---|---|---|---|
| Name | `fldvOXTEZTgCyhY3J` | Formula | Computed display text for the lyric line | `"Twist and shout"` |
| codified text | `fldZKNO4RtBhP4Ivk` | Long text | HTML-formatted version of the line (bold/italic) used for display | `"<b>Twist and shout</b>"` |
| Line | `fldQsTIgfwT5AkjYx` | Long text (rich text) | Raw Markdown source of the line | `"**Twist and shout**\n"` |
| Medley | `fldhJtystptZihHaB` | Link to Medleys | Array of linked Medley record IDs | `["recABC123"]` |
| order | `fldn0xiN4gTeC638U` | Number (integer) | Sort order within a medley | `1` |
| Performers | `fldbt3Zm9VtYVFfmR` | Link to Performers | Array of linked Performer record IDs | `["recXYZ789"]` |
| Time | `fldfSd6TAjwrwGJRo` | Single select | Timestamp bracket for the line in the recording | `"1.01-1.30"` |

#### Per-performer fields

Each performer has two fields: `{initials} Mistake` and `{initials} Notes`.
The initials match the `performer` field in the Performers table.

| Performer | Mistake field ID | Notes field ID |
|---|---|---|
| SF | `fldrlFUaVI5ZQ9Qhq` | `fldGvNRVVfvuvTkBg` |
| GH | `flds8GERaW9PEUYbK` | `fldGqrVVE8IB2QqYO` |
| SB | `fldJPjcQF6dXz8oTI` | `fldMtel3rL9hCOPUD` |
| SA | `fldy6KLF3GHefROC5` | `fldwdUlfxPsdxuMA3` |
| JB | `fldjoyQSmxMDoJezZ` | `fldQiZg4BfA0fm58p` |
| OT | `fldSrOXwQCHHsEhmv` | `fldP3J1JhkoGZhXO4` |
| LS | `fldH7D21HRf99aoTV` | `fldUik3izLPLQiyV0` |
| JA | `fldStEKclvdZ5fqXr` | `fldrG7xK6hgcjJnjN` |
| THi | `fldtuwCRMRQT4OFtp` | `fldhB43jJa3zBISup` |
| RK | `fldQy66884RH34Oxn` | `fldqIyXFmLPYRSLqX` |
| WR | `fldOuE3OZmixVKkvS` | `fldiyftyC6CWsrLBT` |
| OB | `fld2uubOt7KgXSqpc` | `fldxOfxahvaocrdxJ` |
| GB | `fldWkzVXKL7GlSbSi` | `fldYsWUdY4U7QkLJG` |
| HM | `fld8LjNyXYmm3CLVk` | `fldJR1xryB7GOaPKb` |
| JV | `fldpaRvNq95dBFc8l` | `fldMX1YY5W8ULTOrk` |
| AC | `fld59aiwWcPIUd0Sb` | `fldwFgVSvjfxa0kJw` |
| KG | `fldc78X5fkPzvsdCS` | `fldzopyDkqWTlpslY` |
| BP | `fldO6tPHQuma84Naq` | `fldRw2snXUO3I65Z7` |
| JM | `fldLTye5OSEhFa7c0` | `fld0PBh1earQTcwG5` |
| RH | `fld4YMw7b4vrdZ98j` | `fldXueZEifOY8KMeC` |
| OH | `fldSVU2McAqLInLfu` | `fld1daeNalYtZxtPG` |
| KGn | `fldTRfm6zRKafKYNZ` | `fldFKuk2BOfTgop1E` |
| TH | `fldoOB7RCJ2lxKPqx` | `fld0gQeJ97ccblM6c` |
| PW | `fldwD8AKWk0Jx1ii9` | `fldrbk7CKhzpjIhEI` |
| JCh | `fldEYjshS1LJxVJiM` | `fldYUFo6doXqluhsE` |
| FM | `fldfICennRmjSrVSB` | `fldbStvEidCu1YstU` |
| JBr | `fldMjREhbL6aFI0Dq` | `flda1kgFe4uYpY6Ur` |
| NB | `fldhIJ4roV5hAwreH` | `fldpioddG9FmMxVQv` |
| LB | `fldbkgR44UCjxwhCA` | `fldSBhjXZRgViOHfR` |
| TF | `fldMUQAjxju3wcqSm` | `fldEujroaGt6Tp1Wg` |
| LM | `fld1kpsYr2TFQO68W` | `fldUUNdEhquVkdHuH` |
| JZ | `fld1BlEfvCd0gcEyu` | `fldYPpi4lUGvKH5Ok` |
| JBa | `fldsIoWpihH4nZfSs` | `fld6Hm3lRpQDjXJuf` |
| EM | `fldOqlVJn9C1aTmle` | `fldz2gQ8N7VkJEaUC` |
| RS | `fldRI9EuTNDluREEz` | `fldPdIfxZbuqgELis` |
| JPa | `fldks7af0Z5AokjBQ` | `fldwFm5Lkp8NTphCh` |
| CP | `fld1Anrd7JDtXxzWb` | `fldwAMoIym30jMNjO` |
| MA | `fldGE2kT7UzqN3GTt` | `fld6qP36pcfqq5h6W` |
| AS | `fldXkVz0ZFyaSmceI` | `fldL9dlURmkDSQgaU` |
| LJ | `fldivuKPS1cuLPASu` | `fld2dK1K3r1ZcDQew` |
| LF | `fldjBcth2HD038qmO` | `fldD2fBs3DYJeRCw3` |
| EO | `fldRyWs35kLmckIDk` | `fldd9qzhyxLAXMyTS` |
| DSt | `fldm0CzNvKhRLX8gI` | `fld9UJVVq2M3r01Kr` |
| SK | `fld9XNc0j8uK5lYrM` | `fldHmj8ezPVbwAPY9` |
| JWo | `fldRBOX2DwjoNKyz0` | `fldRW5VrUIGNggW0a` |
| HH | `fldGDzhbRodMHkQOx` | `fldfn56nrz5hhTGUa` |
| JFi | `fldEdaN69lt1ruhAd` | `fldEzfHXz6730iCnH` |
| JTa | `fld7lzDdxJyAWrG3n` | `fldAI6yabTpo3v0Xo` |

**Mistake field type:** Multiple select. Valid values:
`"Melody 🎵"`, `"Rhythm 🥁"`, `"Delivery 🎭"`, `"Lyrics 📚"`, `"Entry 🚦"`, `"Drums 🪘"`, `"Guitar 🎸"`

---

### Locations

**Purpose:** One record per gig location shown on the public world map at
`/map`. Managed by admins via `/map/admin`. The public map JS fetches all
records from `GET /api/locations` (no auth required).

**Table ID:** `tblijHhtJW0XVEPaa`

| Field Name | Field ID | Type | Description | Example |
|---|---|---|---|---|
| title | `fldfbxCQ9ITdIqiuP` | Single line text | Location display name | `"Pembroke College, Cambridge"` |
| gigDate | `fldP5FBlOyLQ2s7BE` | Date | Date of the gig (ISO 8601) | `"2024-06-15"` |
| videoTitle | `fldcJXewmOFLwGXtU` | Single line text | Title shown in the map popup | `"Cambridge Summer Concert"` |
| videoUrl | `fldxVCiesU2ZlcGii` | Single line text | Full YouTube URL (validated on save) | `"https://youtu.be/dQw4w9WgXcQ"` |
| latitude | `fldIT1FvYwTIC6a47` | Number (decimal) | WGS84 latitude | `52.2016` |
| longitude | `fldmtbs82iFwX6JyR` | Number (decimal) | WGS84 longitude | `0.1149` |

> The `videoUrl` field must be a valid YouTube URL matching one of:
> `youtube.com/watch?v=`, `youtu.be/`, or `youtube.com/embed/`. The server
> enforces this validation and will reject invalid URLs with a 400 error.

---

### Users

**Purpose:** One record per application user. Managed exclusively via the
`scripts/create-user.js` CLI script — there is no in-app user management UI.
Deactivate a user by unchecking the `active` checkbox directly in Airtable.

**Table ID:** `tblUSRLRuXOiidVIG`

| Field Name | Field ID | Type | Description | Example |
|---|---|---|---|---|
| email | `fldveQFBsVj9NiJ0x` | Single line text | Login email address (unique) | `"garry@trulymedleydeep.com"` |
| name | `fldEhK8lkFNC7W2iC` | Single line text | Display name shown in nav | `"Garry Hall"` |
| role | `fld1HDL1yQEKjBke5` | Single select | One of: `super_admin`, `admin`, `performer` | `"super_admin"` |
| passwordHash | `fldmjaz1UrMfIFX2A` | Single line text | bcrypt hash (12 rounds) — never a plain-text password | `"$2b$12$..."` |
| active | `fld1cmRs4Iue9MrFh` | Checkbox | If unchecked, login is rejected even with correct credentials | `true` |

**Roles:**

| Role | Access |
|---|---|
| `super_admin` | All routes + future user management |
| `admin` | Lyrics tool + map admin |
| `performer` | Lyrics tool only |

---

## Constraints and limits

| Constraint | Detail |
|---|---|
| Batch update limit | Maximum **10 records per request**. The app's `batchUpdate()` helper chunks updates into groups of 10 automatically. |
| Rate limit | Airtable enforces ~5 requests/second per base. The app does not parallelise requests aggressively so this is not a concern in practice. |
| Session persistence | Sessions use `memorystore` (in-process). They are **lost on Render dyno restart**. Users will need to log in again after a restart. This is acceptable for an internal tool. |
| Mapbox token | The public Mapbox token is embedded in rendered HTML. It must be restricted in the Mapbox dashboard to the Render service domain and `localhost` to prevent unauthorised use. |
| Airtable free plan | The base is on the free plan. Record limits and attachment storage limits apply — check the Airtable dashboard if data volume grows significantly. |
