import { notifications } from "@mantine/notifications";

import { i18n } from "../i18n";
import { ApiError } from "./client";
import { validationText } from "./validationText";

/** What to tell people about an error: the text for its code or its problems, or else the message it came with. */
export function errorText(error: Error): string {
  if (error instanceof ApiError && error.issues) return validationText(error.issues);
  if (error instanceof ApiError && error.code) {
    const key = `errors:codes.${error.code}`;
    // A newer server can send a code this build has no text for. The values are only known at run
    // time, so the cast stops t() wanting every placeholder of every code.
    if (i18n.exists(key, error.params)) return i18n.t(key as "errors:title", error.params);
  }
  return error.message;
}

/** The toast for a request that failed. */
export function notifyError(error: Error) {
  notifications.show({ color: "red", title: i18n.t("errors:title"), message: errorText(error) });
}
