import useSWR from "swr";
import { API } from "@koh/api-client";
import { User } from "@koh/common";

type Hook = () => User;

// Set before reloading for a 401, so a 401 that a reload can't fix (such as
// an unverified Keycloak email) doesn't reload forever
const RELOADED_FOR_401 = "reloadedFor401";
// Many components call useProfile, so only the first 401 per page load acts
let handlingUnauthorized = false;

function handleUnauthorized(): void {
  if (handlingUnauthorized) return;
  handlingUnauthorized = true;
  let alreadyReloaded = false;
  try {
    alreadyReloaded = sessionStorage.getItem(RELOADED_FOR_401) !== null;
    sessionStorage.setItem(RELOADED_FOR_401, "1");
  } catch {
    // Without storage, fall through to a single reload attempt
  }
  if (alreadyReloaded) {
    // Signing out clears oauth2-proxy's session, so the next sign in starts fresh
    window.location.href = "/oauth2/sign_out?rd=%2Fsigned-out";
  } else {
    // oauth2-proxy answers API calls with 401 when the session has expired.
    // A full page load lets it send the browser to Keycloak to log in again.
    window.location.reload();
  }
}

export const useProfile: Hook = () => {
  const { data, error } = useSWR(
    `api/v1/profile`,
    async () => await API.profile.index()
  );

  if (error?.response?.status === 401) {
    handleUnauthorized();
  } else if (data) {
    try {
      sessionStorage.removeItem(RELOADED_FOR_401);
    } catch {
      // ignore
    }
    return data;
  }
};
