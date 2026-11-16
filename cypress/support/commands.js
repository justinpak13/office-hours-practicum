// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })

import { checkNavbarLoaded } from "../utils";

// Percy (visual screenshots) isn't set up for this project: there is no
// PERCY_TOKEN, so snapshots were never taken. @percy/cypress 3 also uses
// JavaScript syntax that Cypress 8.7's bundler can't read, which stopped
// every test file from loading. Keep the command so the tests still wait
// for the nav bar at the same points.
Cypress.Commands.add("percySnapshot", (snapshotName) => {
  checkNavbarLoaded();
});
