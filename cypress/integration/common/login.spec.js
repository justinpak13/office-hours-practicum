const { createAndLoginTA, expectLoggedOut } = require("../../utils");

describe("Login", () => {
  it("redirect to login if not logged in", () => {
    if (Cypress.env("OAUTH_PROXY")) {
      // Behind oauth2-proxy, a visitor without a session is sent to Keycloak.
      // That's another origin, so check the redirect instead of visiting it.
      cy.clearCookies();
      cy.request({ url: "/", followRedirect: false }).then((res) => {
        expect(res.status).to.eq(302);
        expect(res.redirectedToUrl).to.include("/protocol/openid-connect/auth");
      });
    } else {
      cy.visit("/");
      cy.location("pathname").should("eq", "/login");
    }
  });

  it("logout works", () => {
    createAndLoginTA();
    cy.visit(`/`);
    cy.get("[data-cy='avatar-button']").click();
    cy.get("[data-cy='logout-button']").should("be.visible").click();
    expectLoggedOut();
  });
});
