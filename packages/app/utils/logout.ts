import { LogoutResponse } from "@koh/common";
import axios from "axios";

// Signs out of the app, and of Keycloak when running behind oauth2-proxy.
// The server says where to go: oauth2-proxy's sign out, or /login without it.
export async function logout(): Promise<void> {
  let redirect = "/login";
  try {
    const res = await axios.post<LogoutResponse>("/api/v1/logout");
    redirect = res.data?.redirect ?? redirect;
  } catch {
    // Still leave the page, so the user isn't stuck looking logged in
  }
  window.location.href = redirect;
}
