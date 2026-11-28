// oauth2-proxy's sign out clears its session cookie, ends the Keycloak
// session and sends the browser to /signed-out.
export function logout(): void {
  window.location.href = "/oauth2/sign_out?rd=%2Fsigned-out";
}
