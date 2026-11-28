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

/**
 * Logs in to oauth2-proxy through the fake Keycloak, the way a browser would
 * (start -> authorize -> pick a test user -> callback), but with cy.request so
 * the test never leaves the app's origin. Afterwards the browser has the
 * __Host-oauth2_proxy cookie, so pages and API calls reach the app.
 *
 * The app sees the Keycloak user's ID token, so it acts as the app user with
 * the same Keycloak `sub` (createUserAndLogin in utils.js seeds them). Without
 * a username, it logs in as OAUTH_PROXY_USER, who is only used to get
 * requests such as /api/v1/seeds/* past oauth2-proxy.
 * @param {string} username - a username from oauth2-proxy-demo/fake-keycloak/users.json
 */
Cypress.Commands.add(
  "proxyLogin",
  (username = Cypress.env("OAUTH_PROXY_USER")) => {
    const step = (options) =>
      cy.request({ followRedirect: false, ...options }).then((res) => {
        expect(res.status, `${options.url} redirects`).to.be.within(300, 399);
        return res.redirectedToUrl;
      });

    // Leave any app page first. While the session switches, its API calls
    // get 401s, and the app answers a 401 by reloading, which oauth2-proxy
    // sends to Keycloak (another origin, so Cypress fails). /signed-out
    // doesn't call the API and the proxy serves it without a session.
    cy.location("pathname", { log: false }).then((pathname) => {
      if (pathname !== "blank" && pathname !== "/signed-out") {
        cy.visit("/signed-out", { log: false });
      }
    });

    // Start from no proxy session, so nothing from the previous user (such as
    // a leftover piece of a split session cookie) can outlive the switch
    clearProxyCookies(() => true);

    step({ url: "/oauth2/start?rd=/" })
      // Keycloak's authorize endpoint sends us to its login page
      .then((authorizeUrl) => step({ url: authorizeUrl }))
      // Submit the "Pick a test user" form, which sends us back to the proxy
      .then((loginPageUrl) => {
        const loginPage = new URL(loginPageUrl);
        return step({
          method: "POST",
          url: loginPage.href.replace(/\/login\?.*$/, "/endpoint"),
          form: true,
          body: {
            session_code: loginPage.searchParams.get("session_code"),
            username,
          },
        });
      })
      // oauth2-proxy trades the code for tokens and sets its session cookie
      .then((callbackUrl) => step({ url: callbackUrl }));

    // Each login leaves a CSRF cookie behind (COOKIE_CSRF_PER_REQUEST), and
    // they'd otherwise pile up in every later request's headers
    clearProxyCookies((name) => name.endsWith("_csrf"));
  }
);

/**
 * Deletes the browser's oauth2-proxy cookies (named __Host-oauth2_proxy...)
 * that match the filter.
 * @param {(name: string) => boolean} filter - which cookie names to delete.
 */
function clearProxyCookies(filter) {
  cy.getCookies().then((cookies) =>
    cookies
      .filter((c) => c.name.startsWith("__Host-oauth2_proxy") && filter(c.name))
      .forEach((c) => cy.clearCookie(c.name))
  );
}
