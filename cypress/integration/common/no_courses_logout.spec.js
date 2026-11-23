const { createAndLoginStudent, expectLoggedOut } = require("../../utils")

describe("Testing no courses logout", () => {
    it("Creates user with no courses", () => {
        createAndLoginStudent()
        cy.get("@student").then((student) => {
            // withdraw student from class
            cy.request('DELETE', `/api/v1/courses/${student.course.id}/withdraw_course`)
            // reload page to have student with no classes
            cy.visit('/')
            cy.get("body").should("contain", "None of your courses are using the Khoury Office Hours App.");
            // execute logout action
            cy.get("[data-cy='logout-button']").click()
            expectLoggedOut()
        });
    })
})