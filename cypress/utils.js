import keycloakUsersFile from "../oauth2-proxy-demo/fake-keycloak/users.json";

export const checkNavbarLoaded = () => {
  cy.get("nav").should("contain", "CS 2500");
  cy.get("nav").should("contain", "Schedule");
};

export const getId = (id) => {
  if (!id) {
    return cy.wrap();
  } else if (typeof id == "number") {
    return cy.wrap(id);
  } else {
    return accessAttributes(id);
  }
};

export const accessAttributes = (str) => {
  const arr = str.split(".");
  const primaryObj = arr.shift();
  return cy
    .get(`@${primaryObj}`)
    .then((obj) => arr.reduce((data, attr) => data[attr], obj));
};

const makeRequest = (request, identifier, { ...params }) => {
  if (identifier) {
    request(params)
      .then((res) => res.body)
      .as(identifier);
  } else {
    request(params);
  }
};

// Fake Keycloak users (oauth2-proxy-demo/fake-keycloak/users.json) that tests
// can log in as: only the cypress.* ones, so tests never give a role to the
// users that the dev seed data (/api/v1/seeds/create) and manual testing use.
// Each user a test creates gets the next one, so one test can have up to
// this many users.
const keycloakUsers = keycloakUsersFile.filter((u) =>
  u.username.startsWith("cypress.")
);
let nextKeycloakUser = 0;
// Each test starts again from the first user (seeds/delete removed them all).
// The hook is here rather than in support/index.js because Cypress bundles
// the support file separately, with its own copy of this counter.
beforeEach(() => {
  nextKeycloakUser = 0;
});

const takeKeycloakUser = () => {
  const user = keycloakUsers[nextKeycloakUser++];
  if (!user) {
    throw new Error(
      `This test creates more than ${keycloakUsers.length} users. Add more cypress.* users to oauth2-proxy-demo/fake-keycloak/users.json.`
    );
  }
  return user;
};

/**
 * Logs the browser in as the given user: through oauth2-proxy as their fake
 * Keycloak user, or with /api/v1/login/dev when testing without the proxy.
 * @param {object} userCourse - a userCourse aliased by createUserAndLogin.
 */
// The fake Keycloak user the browser is logged in to oauth2-proxy as.
// support/index.js logs in as OAUTH_PROXY_USER before each test.
let currentKeycloakUsername;
beforeEach(() => {
  currentKeycloakUsername = Cypress.env("OAUTH_PROXY_USER");
});

const proxyLoginAs = (username) =>
  cy.proxyLogin(username).then(() => {
    currentKeycloakUsername = username;
  });

const logInAs = (userCourse) => {
  if (Cypress.env("OAUTH_PROXY")) {
    proxyLoginAs(userCourse.keycloakUsername);
  } else {
    cy.request(`/api/v1/login/dev?userId=${userCourse.user.id}`);
  }
};

/**
 * Logs in a user with the given identifier alias for cypress.
 * @param {string} identifier - the identifier alias of the user for cypress.
 */
export const loginUser = (identifier) => {
  cy.get(`@${identifier}`).then((userCourse) => {
    logInAs(userCourse);
    cy.visit("/");
    // wait for the defaultCourseRedirect
    cy.url({ timeout: 30000 }).should("include", "today");
  });
};

/**
 * Creates a user and logs them in with the given role into the given course, then aliases the userCourse to cypress using the identifier.
 * The user is a fake Keycloak user, and the alias also has their Keycloak
 * username and the Cookie header that makes requests as them.
 * @param {string} role - One of "ta" or "student", represents a role a user has in our application.
 * @param {stirng} courseId - The id of the course this user is being added to.
 * @param {string} identifier -  The id that cypress will alias this logged-in user to.
 */
const createUserAndLogin = ({ role, courseId, identifier }) => {
  const keycloakUser = takeKeycloakUser();
  const req = (parsedId) => {
    cy.window().then((win) => win.localStorage.setItem("firstTime", false));
    cy.window().then((win) =>
      win.localStorage.setItem("seenApplyModal", false)
    );
    // create the user
    cy.request("POST", "/api/v1/seeds/createUser", {
      role: role,
      courseId: parsedId,
      user: {
        keycloakSub: keycloakUser.id,
        email: keycloakUser.email,
        firstName: keycloakUser.firstName,
        lastName: keycloakUser.lastName,
        nuid: keycloakUser.nuid,
      },
    })
      .then((res) => ({
        ...res.body,
        keycloakUsername: keycloakUser.username,
      }))
      .then((userCourse) => {
        // log them in
        logInAs(userCourse);
        cy.visit(`/course/${userCourse.courseId}/today`);
        // save their cookies in case they're needed for future requests
        cy.getCookies()
          .then((cookies) => ({
            ...userCourse,
            cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
          }))
          .as(identifier);
      });
  };

  if (courseId) {
    getId(courseId).then((courseId) => req(courseId));
  } else {
    req();
  }
};

/**
 * Creates and logs in a TA into the course and uses the identifier to alias the TA's userCourse.
 * @param {number} courseId - the course that this TA will be added to (defaults to null).
 * @param {string} identifier - the id that cypress will alias this logged-in TA to (defaults to "ta").
 */
export const createAndLoginTA = ({ courseId = null, identifier = "ta" } = {}) =>
  createUserAndLogin({
    role: "ta",
    courseId,
    identifier,
  });

/**
 * Creates and logs in a student into the course and uses the identifier to alias the student's userCourse.
 * @param {number} courseId - the course that this student will be added to (defaults to null).
 * @param {string} identifier - the id that cypress will alias this logged-in student to. (defaults to "student").
 */
export const createAndLoginStudent = ({
  courseId = null,
  identifier = "student",
} = {}) =>
  createUserAndLogin({
    role: "student",
    courseId,
    identifier,
  });

/**
 * Creates and logs in a professor into the course and uses the identifier to alias the professor's userCourse.
 * @param {number} courseId - the course that this professor will be added to (defaults to null).
 * @param {string} identifier - the id that cypress will alias this logged-in professor to. (defaults to "professor").
 */
export const createAndLoginProfessor = ({
  courseId = null,
  identifier = "professor",
} = {}) =>
  createUserAndLogin({
    role: "professor",
    courseId,
    identifier,
  });

/**
 * Creates a new queue and binds it to cypress with an alias of the identifier.
 * @param {number} courseId - the course that this queue will be added to (defaults to null).
 * @param {number} room - the room where this queue will occur (defaults to "Online").
 * @param {booelan} allowQuestions - whether or not you want to allow questions in the queue (defaults to true).
 * @param {number} closesIn - how many milliseconds until the queue closes
 * @param {string} identifier - the id that cypress will alias this queue to (defaults to "queue").
 */
export const createQueue = ({
  courseId = null,
  room = "Online",
  allowQuestions = true,
  closesIn = 4500000,
  identifier = "queue",
}) => {
  const req = ({ id }) =>
    cy.request("POST", "/api/v1/seeds/createQueue", {
      courseId: id,
      room,
      closesIn,
      allowQuestions,
    });
  getId(courseId).then((id) => {
    makeRequest(req, identifier, { id });
  });
};

export const createQueueWithoutOfficeHour = ({
  courseId = null,
  allowQuestions = true,
  room = "Online",
}) => {
  const req = ({ id }) =>
    cy.request("POST", "/api/v1/seeds/createQueueWithoutOfficeHour", {
      courseId: id,
      room,
      allowQuestions,
    });
  getId(courseId).then((id) => {
    makeRequest(req, "queue", { id });
  });
};

/**
 * Creates a question and binds it to cypress with an alias of the identifier.
 * @param {number} queueId - the id of the queue this question is being added to.
 * @param {number} studentId - the id of the user specifying this question.
 * @param {any} data - information about the question.
 * @param {string} identifier - the id that cypress will alias this logged-in user to.
 */
export const createQuestion = ({ queueId, studentId, data, identifier }) => {
  const req = ({ queueId, studentId }) =>
    cy.request("POST", "/api/v1/seeds/createQuestion", {
      studentId,
      queueId,
      data,
    });

  getId(queueId).then((queueId) => {
    getId(studentId).then((studentId) =>
      makeRequest(req, identifier, { queueId, studentId })
    );
  });
};

/**
 * Checks the TA into the queue.
 * @param {string} queue - the identifier alias of the queue for cypress (defaults to "queue").
 * @param {string} ta - the identifier alias of the TA for cypress (defaults to "ta").
 */
export const checkInTA = ({ ta = "ta", queue = "queue" } = {}) => {
  cy.get(`@${ta}`).then((ta) => {
    cy.get(`@${queue}`).then((queue) => {
      const url = `/api/v1/courses/${queue.courseId}/ta_location/${queue.room}`;
      if (!Cypress.env("OAUTH_PROXY")) {
        // as the TA, even if another user is logged in now
        cy.request({ method: "POST", url, headers: { Cookie: ta.cookie } });
        return;
      }
      // Behind the proxy, log in as the TA for this request, then switch
      // back. (A Cookie header doesn't work: Cypress adds the browser's own
      // cookies to it, so the request would carry two proxy sessions.)
      const previous = currentKeycloakUsername;
      if (previous !== ta.keycloakUsername) {
        proxyLoginAs(ta.keycloakUsername);
      }
      cy.request({ method: "POST", url });
      if (previous !== ta.keycloakUsername) {
        proxyLoginAs(previous);
      }
    });
  });
};

/**
 * Clicks the visible element with the given data-cy. antd keeps popups
 * (Popconfirm, Modal) in the page after they close, so an earlier popup's
 * button can match the same selector.
 * @param {string} dataCy - the element's data-cy attribute.
 * @param {object} options - options for .click(), such as { force: true }.
 */
export const clickVisible = (dataCy, options) =>
  cy.get(`[data-cy="${dataCy}"]:visible`).click(options);

/**
 * Checks that the browser ended up logged out. Behind oauth2-proxy the app's
 * logout also signs out of the proxy and lands on /signed-out; without the
 * proxy it goes to /login.
 */
export const expectLoggedOut = () => {
  if (Cypress.env("OAUTH_PROXY")) {
    cy.location("pathname").should("eq", "/signed-out");
    cy.get("body").should("contain", "You have signed out");
  } else {
    cy.location("pathname").should("eq", "/login");
    cy.get("body").should("contain", "You are currently not logged in");
  }
};

/**
 * Helps the question with the given id. Keeps the question selected after helping them.
 * @param {number} id - the question id that you want to help.
 */
export const helpQuestionWithID = (id) => {
  cy.get(`[data-cy="list-queue"] [data-cy="queue-list-item-${id}"]`)
    .should("be.visible")
    .click();
  cy.get('[data-cy="help-student"]').click();
  // Cypress never moves the mouse away, so the tooltip of the button that now
  // sits under it ("Finish Helping") stays open and can cover other buttons
  // (React builds onMouseLeave from mouseout events)
  cy.get('[data-cy="finish-helping-button"]:visible').trigger("mouseout");
};

/**
 * Opens up the modal and checks into the default option (usually online if created)
 */
export const taOpenOnline = () => {
  // disabled until the course has loaded
  cy.get("[data-cy='check-in-modal-button']").should("not.be.disabled").click();
  cy.wait(500);
  cy.get('[data-cy="select-existing-queue"]').click();
  cy.get('[data-cy="select-queue-Online"]').click();

  cy.get('[data-cy="check-in-modal"]').should("contain", "Check into a queue");
  cy.get('[data-cy="check-in-submit"]').should("not.be.disabled").click();
};

