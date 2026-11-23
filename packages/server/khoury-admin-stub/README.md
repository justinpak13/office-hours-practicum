# Khoury Admin stub

Dev-only fake of Khoury Admin (`node server.js`, port 4100). It serves the hand-written JSON in `data/` in the shape of Alex's final schema. Never run it in production.

Layout: `data/<semester>/instructors/<email>.json` (endpoint A), `data/<semester>/users/<email>.json` (endpoint B), `data/rosters/<group id>.json` (endpoint C). Unknown person gives an empty list; unknown roster gives 404.

Semester is `202710` (Fall 2026). Group ids are `sg_` + 18 digits: `sg_1...` is a set-up group, `sg_2...` is a course group.

## People

All emails are `@northeastern.edu`, and NUIDs match `oauth2-proxy-demo/fake-keycloak/users.json`, so a demo login lines up with this data.

| Person        | Email        | NUID        | Roles                                                       |
| ------------- | ------------ | ----------- | ----------------------------------------------------------- |
| Eddy Li       | `li.edwa`    | `000000008` | Professor in all three groups                               |
| Will Stenzel  | `stenzel.w`  | `000000006` | TA, CS 2500                                                 |
| Da-Jin Chu    | `chu.daj`    | `000000007` | TA, CS 2500                                                 |
| Stanley Liu   | `liu.sta`    | `000000004` | Student, CS 2500                                            |
| Alex Takayama | `takayama.a` | `000000005` | Student, CS 2500                                            |
| Jordan Rivera | `rivera.jo`  | `000000001` | TA and student in CS 1800 London (B returns TA)             |
| Casey Kim     | `kim.ca`     | `000000002` | Student, CS 1800 London, `last_name: ""`                    |
| Morgan Lee    | `m.lee`      | `000000003` | Student, CS 3500; added to CS 2500 in the `-updated` roster |

## Groups

| Id                              | Name              | Purpose                                                                                                                                   |
| ------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `sg_120271000000000001`         | CS 2500 Fundies 1 | Mirrors the seed (CRNs 10234, 10235)                                                                                                      |
| `sg_120271000000000001-updated` | CS 2500 Fundies 1 | Roster variant for roster-sync tests: Takayama dropped, Lee added. Served when the stub runs with `rosterSuffix: '-updated'` (tests only) |
| `sg_120271000000000002`         | CS 3500 OOD       | Set-up group that received CRNs 20111, 20112 from a course group                                                                          |
| `sg_220271000180000002`         | CS 1800 London    | Course group; Rivera in two lists, Kim with an empty last name                                                                            |
| `sg_220271000350000001`         | CS 3500 Boston    | Moved: no roster file, so C answers 404. Its CRNs are now listed under `sg_120271000000000002` in Eddy Li's endpoint A file               |
