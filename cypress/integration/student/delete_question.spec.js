import {
  createAndLoginStudent,
  createQueue,
  createQuestion, createAndLoginTA, checkInTA,
  clickVisible,
} from "../../utils";

describe("Student can delete their question", () => {
  beforeEach(() => {
    createAndLoginTA();
    createQueue({courseId: "ta.course.id"});
    checkInTA();
    createAndLoginStudent({courseId: "ta.course.id"});
    createQuestion({
      studentId: "student.user.id",
      queueId: "queue.id",
    });
  });

  it("from the queue page", function () {
    cy.visit(`/course/${this.queue.courseId}/queue/${this.queue.id}`);

    cy.get('[data-cy="leave-queue"]').should("be.visible").click();
    clickVisible("leave-queue-confirm");

    cy.get("body").should("contain", "There are no questions in the queue");
  });
});
