# Phase 11 header decision table

The per-column allow/exclude decision for every file in the capture
`.planning/phases/11-new-game-data/11-HEADERS.txt`, which the user produced by
running `header_capture.py` on their own export (plan 11-02, D-12). Column NAMES
only: the capture holds no cell value, no nickname, no email, no account number and
no coordinate, and `tests/fixtures/new-data-headers.ts` re-proves that on every
test run (T-11-06).

**This table is the input to the allowlists.** Plan 11-03 appends
`NEW_DATA_SPEC_FILES` from it; plans 11-07, 11-08, 11-10 and 11-11 build their
fixtures and label maps from the same file. A column marked `allow` here that no
spec names still cannot be stored — the projection is fail-closed (D-08).

## How a row was decided

Eight rules were applied in this order, and the order is the whole method:

| Rule | What it excludes or allows |
|---|---|
| (a) | A column whose name suggests a **person, an account or a device identity**: `NAME`, `NICK`, `LOGIN`, `MAIL`, `BIRTH`, `BDAY`, `PHONE`, `PASS`, `TOKEN`, `SECRET`, `HASH`, `UUID`, `GUID`, `SPA`, `USER`, a bare `ID`, or an `ACCOUNT`/`DEVICE` identifier. |
| (b) | Every latitude, longitude, coordinate, city, town, postal, zip and street column — **even in the geolocation file**. A country-level column is kept and is the only location any pane shows. |
| (c) | An `IP` column is allowed as kind `address` in `HEAT_Session_Geolocation` and the two session files only, and only where the pane renders it masked (D-04, T-04-01). Everywhere else it is excluded. |
| (d) | An ID-like column is allowed **only** when it identifies a game object — a vehicle, a plane, a crew or an item. |
| (e) | Counters, enumerations, flags and timestamps are allowed. |
| (f) | Free-text columns are excluded. |
| (g) | The four WOWP files allow every column the Vehicles builder already reads (`ALL_FIELDS` and the Warplanes 20 `BATTLES` field) that is present in the capture; the two WOWP **account** files additionally allow their non-identifying numeric and date columns. A nickname is never allowed. |
| (h) | A file with no pane gets one line and no table. |

`id` is the camelCase label key a pane's label map uses. It is **not** the stored
key: 11-01 maps every spec column to itself, so the stored header stays the header
as written here, and `id === header` until a real header forces an alias rewrite.

Columns are listed in the order the capture recorded them, not alphabetically.

## `HEAT_Game_Sessions.csv`

- **Pane:** HEAT / Activity + Playtime
- **Captured in:** ACCT-B — 6 columns, 5 allowed

| Header | Decision | Kind | Id | Reason |
|---|---|---|---|---|
| `STARTED_AT` | allow | date | `startedAt` | Session start; the Playtime aggregate already resolves it. |
| `FINISHED_AT` | allow | date | `finishedAt` | Session end; the Playtime aggregate already resolves it. |
| `IP` | allow | address | `ip` | Rule (c): the two session files may carry the address, and the Logins pane masks it until the global reveal (D-04, T-04-01). |
| `COUNTRY_CODE` | allow | text | `countryCode` | Country-level only — the one location column Logins already shows (rule b). |
| `CITY_NAME` | exclude | address | `cityName` | Rule (b): a city column is excluded even in a session file. This is the Pitfall 8 hazard, and it is in the SESSION file, not only in the geolocation file. |
| `CLIENT_PLATFORM_CODE` | allow | text | `clientPlatformCode` | An enumeration (rule e); the platform split is a session fact, not an identity. |

## `HEAT_Session_Geolocation.csv`

- **Pane:** HEAT / Geolocation card
- **Captured in:** ACCT-B — 11 columns, 5 allowed

| Header | Decision | Kind | Id | Reason |
|---|---|---|---|---|
| `ACCOUNT_ID` | exclude | text | `accountId` | Rule (a): an ACCOUNT identifier. It is the one column here that ties the row to the person. |
| `IP` | allow | address | `ip` | Rule (c): this file and the two session files are the only places an address may be stored, and the pane masks it until the global reveal (D-04). |
| `COUNTRY_CODE_ALPHA_3` | allow | text | `countryCodeAlpha3` | Rule (b), the keep half: the only country-level column, and the only location the pane shows. |
| `REGION` | exclude | text | `region` | Rule (b) read as a precision floor: REGION is finer than country, so keeping it would escalate location detail past what Logins shows (Pitfall 8). |
| `CITY` | exclude | address | `city` | Rule (b), named directly: a city column is excluded even in the geolocation file. |
| `ISP_NAME` | exclude | text | `ispName` | Rule (a): a NAME column, and it names the network account the session ran through. |
| `ASN` | exclude | text | `asn` | Rule (d) refuses it: an ID-like column that identifies a network, not a game object. |
| `ASN_NAME` | exclude | text | `asnName` | Rule (a): a NAME column, and it names the network provider. |
| `CONNECTION_SPEED` | allow | number | `connectionSpeed` | Rule (e): a non-identifying measurement that belongs to the connection, not the person. |
| `LAST_SESSION_STARTED_DT` | allow | date | `lastSessionStartedDt` | Rule (e): a timestamp; it bounds the geolocation row to a session. |
| `LAST_SESSION_FINISHED_DT` | allow | date | `lastSessionFinishedDt` | Rule (e): a timestamp; it bounds the geolocation row to a session. |

## `WOTC_Game_Sessions.csv`

- **Pane:** WoT Console / Activity + Playtime
- **Captured in:** ACCT-A — 3 columns, 3 allowed

| Header | Decision | Kind | Id | Reason |
|---|---|---|---|---|
| `STARTED_AT` | allow | date | `startedAt` | Session start; the Playtime aggregate already resolves it. |
| `FINISHED_AT` | allow | date | `finishedAt` | Session end; the Playtime aggregate already resolves it. |
| `IP` | allow | address | `ip` | Rule (c): the two session files may carry the address, and the Logins pane masks it until the global reveal (D-04, T-04-01). |

## `HEAT_Account_Statistics.csv`

- **Pane:** HEAT / Account statistics card
- **Captured in:** ACCT-B — 7 columns, 7 allowed

| Header | Decision | Kind | Id | Reason |
|---|---|---|---|---|
| `REGISTRATION_DT` | allow | date | `registrationDt` | Rule (e): an account-lifecycle timestamp with no identifier in it. |
| `ACTIVATION_DT` | allow | date | `activationDt` | Rule (e): an account-lifecycle timestamp with no identifier in it. |
| `FIRST_LOGIN_DT` | allow | date | `firstLoginDt` | Rule (e): an account-lifecycle timestamp with no identifier in it. |
| `FIRST_LOGIN_PLATFORM` | allow | text | `firstLoginPlatform` | Rule (e): an enumeration of the first client, not an identity. |
| `FIRST_BATTLE_DT` | allow | date | `firstBattleDt` | Rule (e): an account-lifecycle timestamp with no identifier in it. |
| `FIRST_PAYMENT_DT` | allow | date | `firstPaymentDt` | Rule (e): a payment timestamp; the finance pane owns amounts, this is a date only. |
| `COUNTRY_CODE` | allow | text | `countryCode` | Rule (b), the keep half: country level, and the only location an account card shows. |

## `HEAT_Battle_Types_Statistics.csv`

- **Pane:** HEAT / Battle types card
- **Captured in:** ACCT-B — 20 columns, 20 allowed

| Header | Decision | Kind | Id | Reason |
|---|---|---|---|---|
| `GAME_MODE` | allow | text | `gameMode` | Rule (e): an enumeration, and the grouping key of the battle-types card. |
| `GAME_SOURCE` | allow | text | `gameSource` | Rule (e): an enumeration of where the battle came from. |
| `BATTLES` | allow | number | `battles` | Rule (e): a counter. |
| `WINS` | allow | number | `wins` | Rule (e): a counter. |
| `LOSSES` | allow | number | `losses` | Rule (e): a counter. |
| `DRAWS` | allow | number | `draws` | Rule (e): a counter. |
| `ND` | allow | number | `nd` | Rule (e): a counter, on the same footing as the other battle totals. |
| `DAMAGE` | allow | number | `damage` | Rule (e): a counter. |
| `DAMAGE_TAKEN` | allow | number | `damageTaken` | Rule (e): a counter. |
| `FRAGS` | allow | number | `frags` | Rule (e): a counter. |
| `KILL_ASSIST` | allow | number | `killAssist` | Rule (e): a counter. |
| `DEATHS` | allow | number | `deaths` | Rule (e): a counter. |
| `SHOOT_DONE` | allow | number | `shootDone` | Rule (e): a counter. |
| `HITS_DONE` | allow | number | `hitsDone` | Rule (e): a counter. |
| `CAPTURE_POINTS` | allow | number | `capturePoints` | Rule (e): a counter. |
| `TIME_PLAYED_BY_HUMAN` | allow | number | `timePlayedByHuman` | Rule (e): a duration counter, and the one playtime-shaped figure HEAT reports per mode. |
| `VEHICLE_EXPERIENCE` | allow | number | `vehicleExperience` | Rule (e): a counter. |
| `FRONTMAN_EXPERIENCE` | allow | number | `frontmanExperience` | Rule (e): a counter. |
| `ARENA_START_TS` | allow | date | `arenaStartTs` | Rule (e): a timestamp. |
| `ARENA_END_TS` | allow | date | `arenaEndTs` | Rule (e): a timestamp. |

## `HEAT_Account_Storage.csv`

- **Pane:** HEAT / Storage card
- **Captured in:** ACCT-B — 4 columns, 4 allowed

| Header | Decision | Kind | Id | Reason |
|---|---|---|---|---|
| `ASSET_CODE` | allow | text | `assetCode` | Rule (d): an identifier for a game object (an owned asset), not for a person. |
| `FIRST_OWNED_TS` | allow | date | `firstOwnedTs` | Rule (e): a timestamp that dates the asset, not the person. |
| `REALM_CODE` | allow | text | `realmCode` | Rule (e): an enumeration of the shard the asset sits on. |
| `ASSET_NAME` | allow | text | `assetName` | Rule (d), the one place rule (a) is NOT read literally: this NAME is an in-game item label, not a person. See Notes — the keyword test and its stated intent diverge here and the intent wins. |

## `WOWP_19_Plane_Statistics.csv`

- **Pane:** Vehicles / Warplanes 19 table
- **Captured in:** ACCT-A — 41 columns, 14 allowed

| Header | Decision | Kind | Id | Reason |
|---|---|---|---|---|
| `ACHIEVEMENTS` | exclude | text | `achievements` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `BASE_GAIN_EXPERIENCE` | exclude | text | `baseGainExperience` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `CREATED_AT` | exclude | date | `createdAt` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `GAIN_EXPERIENCE` | allow | number | `gainExperience` | Rule (g): read by the Vehicles builder, so it must be allowed — Pitfall 2. |
| `GAMES_PLAYED` | allow | number | `gamesPlayed` | Rule (g): read by the Vehicles builder, so it must be allowed — Pitfall 2. |
| `IN_GARAGE` | allow | text | `inGarage` | Rule (g): read by the Vehicles builder, so it must be allowed — Pitfall 2. |
| `IN_GARAGE_UPDATED` | exclude | text | `inGarageUpdated` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `LAST_GAME_TIME` | allow | date | `lastGameTime` | Rule (g): read by the Vehicles builder, so it must be allowed — Pitfall 2. |
| `LOSSES` | exclude | text | `losses` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `MAX_ASSISTS` | exclude | text | `maxAssists` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `MAX_ASSISTS_GROUND` | exclude | text | `maxAssistsGround` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `MAX_DAMAGE_DEALT` | allow | number | `maxDamageDealt` | Rule (g): read by the Vehicles builder, so it must be allowed — Pitfall 2. |
| `MAX_GAIN_CREDITS` | exclude | text | `maxGainCredits` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `MAX_GAIN_EXPERIENCE` | allow | number | `maxGainExperience` | Rule (g): read by the Vehicles builder, so it must be allowed — Pitfall 2. |
| `MAX_GRO_OB_DEST_BY_WEAPON_TYPE` | exclude | text | `maxGroObDestByWeaponType` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `MAX_GROUND_OBJECTS_DESTROYED` | exclude | text | `maxGroundObjectsDestroyed` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `MAX_KILLED` | exclude | text | `maxKilled` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `MAX_KILLED_BY_WEAPON_TYPE` | exclude | text | `maxKilledByWeaponType` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `MAX_STRUCTURE_DAMAGE` | exclude | text | `maxStructureDamage` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `MAX_STRUCTURE_DES_BY_WEAP_TYPE` | exclude | text | `maxStructureDesByWeapType` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `MEDALS` | exclude | text | `medals` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `VEHICLE_NAME` | allow | number | `vehicleName` | The vehicle identifier, and the only one the capture holds for Warplanes: rule (d), read by the Vehicles builder as `vehicle`. |
| `RIBBONS` | exclude | text | `ribbons` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `SHOTS_RECEIVED` | exclude | text | `shotsReceived` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `SPOTTED` | allow | number | `spotted` | Rule (g): read by the Vehicles builder, so it must be allowed — Pitfall 2. |
| `SQUAD_GAMES` | exclude | text | `squadGames` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `SQUAD_WINS` | exclude | text | `squadWins` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `SUPERIORITY_POINTS` | exclude | text | `superiorityPoints` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `SURVIVED` | allow | number | `survived` | Rule (g): read by the Vehicles builder, so it must be allowed — Pitfall 2. |
| `TOTAL_ASSISTS` | exclude | text | `totalAssists` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `TOTAL_ASSISTS_GROUND` | exclude | text | `totalAssistsGround` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `TOTAL_DAMAGE_DEALT` | allow | number | `totalDamageDealt` | Rule (g): read by the Vehicles builder, so it must be allowed — Pitfall 2. |
| `TOTAL_GROUND_OBJECTS_DESTROYED` | exclude | text | `totalGroundObjectsDestroyed` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `TOTAL_HITS` | allow | number | `totalHits` | Rule (g): read by the Vehicles builder, so it must be allowed — Pitfall 2. |
| `TOTAL_KILLED` | allow | number | `totalKilled` | Rule (g): read by the Vehicles builder, so it must be allowed — Pitfall 2. |
| `TOTAL_SHOTS` | allow | number | `totalShots` | Rule (g): read by the Vehicles builder, so it must be allowed — Pitfall 2. |
| `TOTAL_STRUCTURE_DAMAGE` | exclude | text | `totalStructureDamage` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `TOTAL_TEAM_OBJECTS_DESTROYED` | exclude | text | `totalTeamObjectsDestroyed` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `TOTAL_TURRETS_DESTROYED` | exclude | text | `totalTurretsDestroyed` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `UPDATED_AT` | exclude | date | `updatedAt` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `WINS` | allow | number | `wins` | Rule (g): read by the Vehicles builder, so it must be allowed — Pitfall 2. |

## `WOWP_20_Plane_Statistics.csv`

- **Pane:** Vehicles / Warplanes 20 NOTE (not a table)
- **Captured in:** ACCT-A, ACCT-B — 56 columns, 4 allowed

| Header | Decision | Kind | Id | Reason |
|---|---|---|---|---|
| `UPDATED_AT` | exclude | date | `updatedAt` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `AT_DAMAGE_MAX` | exclude | text | `atDamageMax` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `AT_KILL_MAX_DF` | exclude | text | `atKillMaxDf` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `B_SCORE` | exclude | text | `bScore` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `B_SCORE_AVG` | exclude | text | `bScoreAvg` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `B_SCORE_MAX` | exclude | text | `bScoreMax` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `BASE_XP` | exclude | text | `baseXp` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `BASE_XP_AVG` | exclude | text | `baseXpAvg` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `BASE_XP_MAX` | exclude | text | `baseXpMax` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `B_ASSIST` | exclude | text | `bAssist` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `B_DAMAGE` | exclude | text | `bDamage` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `B_DAMAGE_MAX` | exclude | text | `bDamageMax` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `B_KILL` | exclude | text | `bKill` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `B_KILL_MAX` | exclude | text | `bKillMax` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `D_ASSIST` | exclude | text | `dAssist` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `D_DAMAGE` | exclude | text | `dDamage` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `D_DAMAGE_MAX` | exclude | text | `dDamageMax` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `D_KILL` | exclude | text | `dKill` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `D_KILL_MAX` | exclude | text | `dKillMax` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `G_ASSIST` | exclude | text | `gAssist` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `G_DAMAGE` | exclude | text | `gDamage` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `G_DAMAGE_MAX` | exclude | text | `gDamageMax` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `G_KILL` | exclude | text | `gKill` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `G_KILL_MAX` | exclude | text | `gKillMax` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `G_KILL_MAX_DF` | exclude | text | `gKillMaxDf` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `DB_DAMAGE_MAX` | exclude | text | `dbDamageMax` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `DB_KILL_MAX` | exclude | text | `dbKillMax` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `DEATHS` | exclude | text | `deaths` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `DRAWS` | exclude | text | `draws` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `BATTLES` | allow | number | `battles` | Read by the Vehicles builder as `battles`. Pitfall 2 forbids an allowlist narrower than the builder vocabulary. |
| `FLIGHTS` | exclude | text | `flights` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `FLIGHTTIME` | exclude | text | `flighttime` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `FLIGHTTIME_AVG` | exclude | text | `flighttimeAvg` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `LAST_GAME_TIME` | allow | date | `lastGameTime` | Rule (g): read by the Vehicles builder, so it must be allowed — Pitfall 2. |
| `LOSSES` | exclude | text | `losses` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `WINS` | allow | number | `wins` | Rule (g): read by the Vehicles builder, so it must be allowed — Pitfall 2. |
| `P_ASSIST` | exclude | text | `pAssist` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `P_DAMAGE` | exclude | text | `pDamage` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `P_DAMAGE_MAX` | exclude | text | `pDamageMax` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `P_KILL` | exclude | text | `pKill` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `P_KILL_DEF_ZONE` | exclude | text | `pKillDefZone` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `P_KILL_DEF_ZONE_MAX` | exclude | text | `pKillDefZoneMax` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `P_KILL_MAX` | exclude | text | `pKillMax` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `ZONE_CAPTURE` | exclude | text | `zoneCapture` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `CHOSEN` | exclude | text | `chosen` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `FIRST_CHOSEN` | exclude | text | `firstChosen` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `RANKS` | exclude | text | `ranks` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `P_KILL_AVG` | exclude | text | `pKillAvg` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `DB_KILL_AVG` | exclude | text | `dbKillAvg` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `G_KILL_AVG` | exclude | text | `gKillAvg` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `AT_KILL_AVG_DF` | exclude | text | `atKillAvgDf` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `G_KILL_AVG_DF` | exclude | text | `gKillAvgDf` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `AT_DAMAGE_AVG_DF` | exclude | text | `atDamageAvgDf` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `G_DAMAGE_AVG_DF` | exclude | text | `gDamageAvgDf` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |
| `IN_GARAGE` | allow | text | `inGarage` | Rule (g): read by the Vehicles builder, so it must be allowed — Pitfall 2. |
| `IN_GARAGE_UPDATED` | exclude | text | `inGarageUpdated` | Rule (g) is scoped to the builder vocabulary for the plane files, and this column is not in it: no pane reads it. |

## `WOWP_19_Account_Statistics.csv`

- **Pane:** Vehicles / Warplanes header + account block (D-02)
- **Captured in:** ACCT-A — 53 columns, 52 allowed

| Header | Decision | Kind | Id | Reason |
|---|---|---|---|---|
| `NAME` | exclude | text | `name` | Rule (a) and rule (g): the account nickname. Never allowed — a nickname is exactly what PRIV-01 exists to keep out. |
| `CREATED_AT` | allow | date | `createdAt` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `UPDATED_AT` | allow | date | `updatedAt` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `PREMIUM_EXPIRY_TIME` | allow | date | `premiumExpiryTime` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `AUTO_BAN_TIME` | allow | date | `autoBanTime` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `ACC_OFFLINE` | allow | text | `accOffline` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `GOLD` | allow | text | `gold` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `ACC_ONLINE` | allow | text | `accOnline` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `EXPERIENCE` | allow | text | `experience` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `LOGOUT_TIME` | allow | date | `logoutTime` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `CREDITS` | allow | text | `credits` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `SLOTS` | allow | text | `slots` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `SPOTTED` | allow | number | `spotted` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `SHOTS_RECEIVED` | allow | text | `shotsReceived` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `SQUAD_GAMES` | allow | text | `squadGames` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `LAST_GAME_TIME` | allow | date | `lastGameTime` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `BASE_GAIN_EXPERIENCE` | allow | text | `baseGainExperience` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `SUPERIORITY_POINTS` | allow | text | `superiorityPoints` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `SURVIVED` | allow | number | `survived` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `SQUAD_WINS` | allow | text | `squadWins` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `GAIN_EXPERIENCE` | allow | number | `gainExperience` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `WINS` | allow | number | `wins` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `LOSSES` | allow | text | `losses` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `GAMES_PLAYED` | allow | number | `gamesPlayed` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `MAX_STRUCTURE_DAMAGE` | allow | text | `maxStructureDamage` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `MAX_GAIN_CREDITS` | allow | text | `maxGainCredits` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `MAX_STRUCTURE_DES_BY_WEAP_TYPE` | allow | text | `maxStructureDesByWeapType` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `MAX_GROUND_OBJECTS_DESTROYED` | allow | text | `maxGroundObjectsDestroyed` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `MAX_DAMAGE_DEALT` | allow | number | `maxDamageDealt` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `MAX_KILLED` | allow | text | `maxKilled` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `MAX_ASSISTS_GROUND` | allow | text | `maxAssistsGround` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `MAX_KILLED_BY_WEAPON_TYPE` | allow | text | `maxKilledByWeaponType` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `MAX_GRO_OB_DEST_BY_WEAPON_TYPE` | allow | text | `maxGroObDestByWeaponType` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `MAX_ASSISTS` | allow | text | `maxAssists` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `MAX_GAIN_EXPERIENCE` | allow | number | `maxGainExperience` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `TOTAL_ASSISTS` | allow | text | `totalAssists` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `TOTAL_DAMAGE_DEALT` | allow | number | `totalDamageDealt` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `TOTAL_TEAM_OBJECTS_DESTROYED` | allow | text | `totalTeamObjectsDestroyed` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `TOTAL_KILLED` | allow | number | `totalKilled` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `TOTAL_HITS` | allow | number | `totalHits` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `TOTAL_GROUND_OBJECTS_DESTROYED` | allow | text | `totalGroundObjectsDestroyed` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `TOTAL_ASSISTS_GROUND` | allow | text | `totalAssistsGround` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `TOTAL_SHOTS` | allow | number | `totalShots` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `TOTAL_TURRETS_DESTROYED` | allow | text | `totalTurretsDestroyed` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `TOTAL_STRUCTURE_DAMAGE` | allow | text | `totalStructureDamage` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `ACHIEVEMENTS` | allow | text | `achievements` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `MEDALS` | allow | text | `medals` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `RIBBONS` | allow | text | `ribbons` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `LANGUAGE` | allow | text | `language` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `CBT_GAMES_PLAYED` | allow | text | `cbtGamesPlayed` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `OBT_GAMES_PLAYED` | allow | text | `obtGamesPlayed` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `EMPTY_SLOTS` | allow | text | `emptySlots` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `GLOBAL_RATING` | allow | text | `globalRating` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |

## `WOWP_20_Account_Statistics.csv`

- **Pane:** Vehicles / Warplanes header + account block (D-02)
- **Captured in:** ACCT-A, ACCT-B — 62 columns, 61 allowed

| Header | Decision | Kind | Id | Reason |
|---|---|---|---|---|
| `NAME` | exclude | text | `name` | Rule (a) and rule (g): the account nickname. Never allowed — a nickname is exactly what PRIV-01 exists to keep out. |
| `CREATED_AT` | allow | date | `createdAt` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `UPDATED_AT` | allow | date | `updatedAt` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `PREMIUM_EXPIRY_TIME` | allow | date | `premiumExpiryTime` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `AUTO_BAN_TIME` | allow | date | `autoBanTime` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `AT_DAMAGE_MAX` | allow | text | `atDamageMax` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `B_ASSIST` | allow | text | `bAssist` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `B_DAMAGE` | allow | text | `bDamage` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `B_DAMAGE_MAX` | allow | text | `bDamageMax` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `B_KILL` | allow | text | `bKill` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `B_KILL_MAX` | allow | text | `bKillMax` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `B_SCORE` | allow | text | `bScore` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `B_SCORE_AVG` | allow | text | `bScoreAvg` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `B_SCORE_MAX` | allow | text | `bScoreMax` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `BASE_XP` | allow | text | `baseXp` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `BASE_XP_AVG` | allow | text | `baseXpAvg` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `BASE_XP_MAX` | allow | text | `baseXpMax` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `BATTLES` | allow | number | `battles` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `CBT_GAMES_PLAYED` | allow | text | `cbtGamesPlayed` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `CREDITS` | allow | text | `credits` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `D_ASSIST` | allow | text | `dAssist` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `D_DAMAGE` | allow | text | `dDamage` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `D_DAMAGE_MAX` | allow | text | `dDamageMax` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `D_KILL` | allow | text | `dKill` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `D_KILL_MAX` | allow | text | `dKillMax` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `DB_DAMAGE_MAX` | allow | text | `dbDamageMax` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `DB_KILL_MAX` | allow | text | `dbKillMax` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `DEATHS` | allow | text | `deaths` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `DRAWS` | allow | text | `draws` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `EMPTY_SLOTS` | allow | text | `emptySlots` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `EXPERIENCE` | allow | text | `experience` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `FLIGHTS` | allow | text | `flights` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `FLIGHTTIME` | allow | text | `flighttime` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `G_ASSIST` | allow | text | `gAssist` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `G_DAMAGE` | allow | text | `gDamage` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `G_DAMAGE_MAX` | allow | text | `gDamageMax` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `G_KILL` | allow | text | `gKill` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `G_KILL_MAX` | allow | text | `gKillMax` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `GLOBAL_RATING` | allow | text | `globalRating` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `GOLD` | allow | text | `gold` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `KD_RATION` | allow | text | `kdRation` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `LANGUAGE` | allow | text | `language` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `LAST_COMPENSATION_TIME` | allow | date | `lastCompensationTime` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `LAST_GAME_TIME` | allow | date | `lastGameTime` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `LOGOUT_TIME` | allow | date | `logoutTime` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `LOSSES` | allow | text | `losses` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `OBT_GAMES_PLAYED` | allow | text | `obtGamesPlayed` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `P_ASSIST` | allow | text | `pAssist` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `P_DAMAGE` | allow | text | `pDamage` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `P_DAMAGE_MAX` | allow | text | `pDamageMax` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `P_KILL` | allow | text | `pKill` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `P_KILL_DEF_ZONE` | allow | text | `pKillDefZone` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `P_KILL_DEF_ZONE_MAX` | allow | text | `pKillDefZoneMax` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `P_KILL_MAX` | allow | text | `pKillMax` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `SLOTS` | allow | text | `slots` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `WINS` | allow | number | `wins` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `ZONE_CAPTURE` | allow | text | `zoneCapture` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `AT_KILL_AVG_DF` | allow | text | `atKillAvgDf` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `G_KILL_AVG_DF` | allow | text | `gKillAvgDf` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `P_KILL_AVG` | allow | text | `pKillAvg` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `DB_KILL_AVG` | allow | text | `dbKillAvg` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |
| `G_KILL_AVG` | allow | text | `gKillAvg` | Rule (g): a non-identifying numeric or date column of the Warplanes account row, for the D-02 account block. |

## `WOWS_Crews.csv`

- **Pane:** Warships crews & storage list row
- **Captured in:** ACCT-A, ACCT-B — 6 columns, 6 allowed

| Header | Decision | Kind | Id | Reason |
|---|---|---|---|---|
| `CREW_ID` | allow | text | `crewId` | Rule (d): an identifier for a game object (a crew), not for a person. |
| `CREW_SHIP` | allow | text | `crewShip` | Rule (d): the ship the crew belongs to — a game object. |
| `CREW_TYPE` | allow | text | `crewType` | Rule (e): an enumeration of crew type. |
| `CREW_LEVEL` | allow | number | `crewLevel` | Rule (e): a counter. |
| `CREW_SHIP_TRAINED` | allow | text | `crewShipTrained` | Rule (e): a flag, not an identity. |
| `CREW_EXPERIENCE` | allow | number | `crewExperience` | Rule (e): a counter. |

## `WOWS_Account_Storage.csv`

- **Pane:** Warships crews & storage list row
- **Captured in:** ACCT-A, ACCT-B — 2 columns, 2 allowed

| Header | Decision | Kind | Id | Reason |
|---|---|---|---|---|
| `ITEM_DESC` | allow | text | `itemDesc` | Rule (d): an in-game item label, so the storage card can name what it holds. A game-object label, not free text (rule f). |
| `AMOUNT` | allow | number | `amount` | Rule (e): a counter. |

## `HEAT_Device_Info.csv`

- **Pane:** none
- **no spec: stores nothing (D-15)** — the file is in a family folder, so it is counted as present, and nothing in it is stored. D-15, Open Question 7.

## `HEAT_Surveys.csv`

- **Pane:** none
- **no spec: stores nothing (D-15)** — the file is in a family folder, so it is counted as present, and nothing in it is stored. D-15, Open Question 7.

## Notes

### 1. Does `WOWP_20_Plane_Statistics.csv` now carry a vehicle identifier? NO

The open question behind Pitfall 2 and the Warplanes 20 pane. The answer from the
capture, on both accounts and with no inference:

- 56 columns, identical in ACCT-A and ACCT-B, from `UPDATED_AT` to `IN_GARAGE_UPDATED`.
- **No `VEHICLE_NAME`. No `ID` of any kind.** No column identifies a plane; `CHOSEN` and `FIRST_CHOSEN` are flags and `RANKS` is a rank value, not a name.
- The file carries the same shape the 2021 sample had: per-plane statistics with no way to say which plane a row is about.

So a `WOWP_20_Plane_Statistics.csv` row cannot be joined to a vehicle, and the
"note, not a table" decision stands unchanged. **Plan 11-10 does not need to revisit
the note-not-table rule.** What the file does contribute is the note's own total: the
builder sums `BATTLES` from this file alone (`WOWP20_BATTLES_FIELD`), which is why
`BATTLES` is the one builder column allowed here alongside `WINS`, `IN_GARAGE` and
`LAST_GAME_TIME`.

The vehicle identifier is real in this export — it is in the **19** file.
`WOWP_19_Plane_Statistics.csv` carries `VEHICLE_NAME`, and it is the only column in
any captured file that identifies a vehicle.

### 2. What `HEAT_Session_Geolocation.csv` carries

Eleven columns, and it is **not** the country-level file its name suggests. The full
capture: `ACCOUNT_ID`, `IP`, `COUNTRY_CODE_ALPHA_3`, `REGION`, `CITY`, `ISP_NAME`,
`ASN`, `ASN_NAME`, `CONNECTION_SPEED`, `LAST_SESSION_STARTED_DT`,
`LAST_SESSION_FINISHED_DT`.

- **Country level is present** (`COUNTRY_CODE_ALPHA_3`) and is the only location column allowed.
- **Coordinates are NOT present.** No latitude and no longitude column exists, so the Pitfall 8 coordinate hazard does not materialise for this file. That is a fact of this capture, not a guarantee about every export.
- **The hazard that IS present is identity and sub-country location**: an `ACCOUNT_ID` that ties the row straight to the person, a `CITY`, a `REGION` finer than country, and two network-identity columns (`ISP_NAME`, `ASN`/`ASN_NAME`).
- Five columns are allowed: `IP` (kind `address`, masked until the global reveal), `COUNTRY_CODE_ALPHA_3`, `CONNECTION_SPEED`, and the two session stamps.

**`CITY_NAME` also appears in `HEAT_Game_Sessions.csv`, not only here.** The Pitfall 8
city hazard is therefore in the session file as well, and it is excluded there too
under rule (b). A reader who only checked the file named "Geolocation" would miss it.

One structural note for 11-04: this file is **not** a session file. `sessionFileNameGame`
requires `_game_sessions.csv`, so the geolocation card needs its own presence fact or
it will read "Not in this export" for a file that is there (Pitfall 4).

### 3. Which HEAT and WoWS record types are present, per account

| File key | ACCT-A | ACCT-B | ACCT-C |
|---|---|---|---|
| `heat_game_sessions.csv` | — | yes | — |
| `heat_session_geolocation.csv` | — | yes | — |
| `heat_account_statistics.csv` | — | yes | — |
| `heat_battle_types_statistics.csv` | — | yes | — |
| `heat_account_storage.csv` | — | yes | — |
| `heat_device_info.csv` | — | yes | — |
| `heat_surveys.csv` | — | yes | — |
| `wotc_game_sessions.csv` | yes | — | — |
| `wows_crews.csv` | yes | yes | — |
| `wows_account_storage.csv` | yes | yes | — |
| `wowp_19_account_statistics.csv` | yes | — | — |
| `wowp_19_plane_statistics.csv` | yes | — | — |
| `wowp_20_account_statistics.csv` | yes | yes | — |
| `wowp_20_plane_statistics.csv` | yes | yes | — |

All seven HEAT files — sessions, geolocation, account statistics, battle types,
storage, device info and surveys — sit in **ACCT-B only**. Both WoWS files sit in
**both** accounts. `ACCT-C` holds none of the target files.

So "a title is absent from this account" is the normal case in this export, not an
edge case: seven of fourteen keys are single-account and five of those are the entire
HEAT feature. Every pane needs an absent-state that reads as absent rather than as
an empty table.

### 4. The delimiter of each file is a COMMA — all eighteen

Every captured file reported `DELIM ,`. Not one semicolon.

This contradicts the Phase 5 evidence recorded in 11-RESEARCH ("exports are
semicolon-delimited with mixed CR/CRLF line endings") and it is load-bearing: a
synthetic fixture that quotes and semicolon-separates these files would parse to one
column per row, and the allowlist would then match nothing and the file would store
nothing — a silent, fail-closed wrong answer rather than a visible failure. Pitfall 10
is exactly this hazard, and the fix is to write the new fixtures comma-delimited.

The line-ending half of the Phase 5 note is untested by this capture: the script
counts CRLF, LF and bare CR alike and prints no terminator, so **mixed line endings
remain unverified for these files** and the synthetic fixtures should keep mixing
them.

### 5. No file's headers differ between accounts

Four keys are captured twice — `wowp_19_*` is not one of them, so the four are
`wowp_20_account_statistics.csv`, `wowp_20_plane_statistics.csv`,
`wows_account_storage.csv` and `wows_crews.csv`. Every one of them agrees **exactly**,
token for token and in the same order.

The byte sizes and line counts do differ, as they must (different accounts), which is
the useful cross-check: same header, different data.

`headersOf(key).divergent` reports this rather than assuming it, so a future capture
that disagrees surfaces as one flag instead of as the first account's allowlist being
silently borrowed by the second.

### 6. Nothing the interface block expects is missing

All fourteen expected file keys are in the capture; none was dropped, and no card is
removed under UI-SPEC assumption A1. `HEAT_Surveys.csv` **is** present, in the
`Surveys` folder, and is out of this phase's scope (PERKS-03, Phase 12) — recorded
here only so the file is named.

Two files the research had flagged as having an unread header turned out to be clean:
`WOWS_Crews.csv` and `WOWS_Account_Storage.csv` carry no personal column at all —
six game-object and counter columns, and two. Every single `allow` decision in this
table is either a game-object label, a counter, an enumeration, a flag or a timestamp.

### 7. Two judgement calls a reviewer should check first

**`HEAT_Account_Storage.ASSET_NAME` is allowed, and it is the one place rule (a) is
not read literally.** Rule (a)'s keyword test would exclude any column containing
`NAME`; its stated intent is to exclude a column that suggests a **person**. An
in-game item name is a game-object label, exactly like `WOWS_Account_Storage.ITEM_DESC`
which is allowed on the same reasoning. Excluding it would leave the HEAT storage card
showing bare codes while the Warships storage card names its items — an inconsistency
with no privacy gain, since neither value identifies a person. If a reviewer disagrees,
edit the row: every later plan reads this table.

**`ASN` is excluded under rule (d), not rule (a).** It is a network identifier, not a
person or an account, so rule (a) does not reach it; rule (d) refuses it because it
identifies a network rather than a game object. It is excluded under a rule that is
about game objects, which is worth stating plainly because the rule does not read
that way at a glance.

### 8. What this table does not decide

- Whether HEAT addresses are ever shown, and in which pane. D-04 left the HEAT pane
  layout to the planner and fixed only that any IP stays masked until the single
  global reveal. Rule (c) stores the column; who shows it is 11-04's question.
- Whether `REGION` is sub-national. It is excluded as finer than country, and if a
  later capture shows it carrying a country code the row can be revisited — widening
  costs a cache rebuild (D-08), which is the reason it is excluded now.
- Scale. The largest captured file is `WOWS_Account_Storage.csv` at 4,295 bytes and 150
  lines. Every windowing and large-fixture proof in this phase is synthetic.
