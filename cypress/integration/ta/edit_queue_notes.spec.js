import {createAndLoginTA, createQueue, taOpenOnline} from "../../utils";

describe("Edit Queue Notes", () => {
  beforeEach(() => {
    createAndLoginTA();
    createQueue({
      courseId: "ta.course.id",
    });
  });

  it("can successfully edit queue notes as a ta on today page", function () {
    cy.visit(`/course/${this.queue.course.id}/today`);
    cy.wait(1500);
    taOpenOnline();
    cy.visit(`/course/${this.queue.course.id}/today`);

    cy.get("[data-cy='edit-notes-button']").click();
    cy.get("[data-cy='edit-notes-input']").click().type("alex has a smooth brain");
    cy.get("[data-cy='save-notes-button']").click();

    cy.get("body").contains("alex has a smooth brain");
  });

  it("from the queue page", function () {
    cy.visit(`/course/${this.queue.course.id}/queue/${this.queue.id}`);

    cy.get("[data-cy='editQueue']").click();

    cy.get("[data-cy='queue-notes-input']").type("read the question!{enter}");

    cy.get("[data-cy='edit-queue-submit']").should("be.visible").click();

    cy.contains("read the question!");
  });
});
