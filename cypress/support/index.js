// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import "./commands";

// Alternatively you can use CommonJS syntax:
// require('./commands')

beforeEach(() => {
  // Cypress clears cookies between tests, so log in to oauth2-proxy each time
  if (Cypress.env("OAUTH_PROXY")) {
    cy.proxyLogin();
  }
  // Don't follow redirects: if the proxy sends us to Keycloak, the seed data
  // wasn't deleted and the test should stop here
  cy.request({ url: "/api/v1/seeds/delete", followRedirect: false })
    .its("status")
    .should("eq", 200);
});

const resizeObserverLoopErrRe = /ResizeObserver loop/;
Cypress.on("uncaught:exception", (err) => {
  /* returning false here prevents Cypress from failing the test */
  if (resizeObserverLoopErrRe.test(err.message)) {
    return false;
  }
});
