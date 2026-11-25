import { createAndLoginTA } from "../../utils";

describe("User can edit their name", () => {
  beforeEach(() => {
    createAndLoginTA();
  });

  it("Changes TA name to Bill Benzel", function () {
    cy.visit(`/settings`).then(() => {
      cy.get("body").should("contain", "First Name");
      cy.percySnapshot("Profile Page");
      cy.get('[data-cy="firstNameInput"]')
        .should("be.visible")
        .clear()
        .type("Billiam");
      cy.get('[data-cy="lastNameInput"]')
        .should("be.visible")
        .clear()
        .type("Benzel");
      cy.get('[data-cy="saveButton"]').should("contain", "Save").click();

      // getting the avatar and making sure the name is properly changed to Bill Benzel (BB)
      cy.get("body").should("contain", "BB");
    });
  });
});
