const { createAndLoginTA } = require("../../utils");

describe("Login", () => {
  it("redirect to login if not logged in", () => {
    cy.visit("/");
    cy.location("pathname").should("eq", "/login");
  });

  it("logout works", () => {
    createAndLoginTA();
    cy.visit(`/`);
    cy.get("[data-cy='profile-avatar']").click({ force: true });
    cy.get("[data-cy='logout-button']").click();
    cy.location("pathname").should("eq", "/login");
    cy.get("body").should("contain", "You are currently not logged in");
  });
});
