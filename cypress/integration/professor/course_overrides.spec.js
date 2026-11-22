import { createAndLoginProfessor, createAndLoginStudent } from "../../utils";

describe("Professor can create an override", () => {
  beforeEach(() => {
    createAndLoginStudent();
    createAndLoginProfessor();
  });

  it("Creates an override and then deletes it", function () {
    const { email, firstName, lastName } = this.student.user;

    cy.visit(`/course/${this.professor.course.id}/course_admin_panel`);
    cy.get("[data-cy='admin-menu-roster']").click();

    // Make the student a TA
    cy.get("[data-cy='override-email']").click().type(email);
    cy.get("[data-cy='override-role']").click();
    cy.get("[data-cy='override-role-ta']").click();
    cy.get("[data-cy='add-override']").click();

    cy.get("[data-cy='override-table']")
      .should("contain", `${firstName} ${lastName}`)
      .and("contain", email)
      .and("contain", "TA");

    // Delete it, and confirm in the popup
    cy.get(`[data-cy='delete-override-${email}']`).click();
    cy.get("[data-cy='confirm-delete-override']").should("be.visible").click();

    cy.get("[data-cy='override-table']").should("not.contain", email);
  });
});
