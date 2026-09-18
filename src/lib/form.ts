import { PUBLIC_WEB3FORMS_KEY } from "astro:env/client";
import { trackConversion } from "./track";

/**
 * Headless contact-form plumbing. The model designs 100% of the form's
 * markup and look; this module provides the tested logic: validation,
 * Web3Forms submission, and idle/sending/success/error states.
 *
 * Markup contract (docs/RECIPES.md): <form data-contact-form> with
 * data-{sending-label,submit-label,success-message,error-message,
 * required-error,email-error,subject}; required fields have an id and an
 * error element with id `${id}-error`; a [data-form-status] element with
 * role="status" aria-live="polite"; optional honeypot input name="botcheck".
 * A submit button whose label wraps in [data-submit-text] keeps icons/markup
 * intact through the sending-state swap; a bare text button also works.
 *
 * Spam protection beyond the honeypot: the access key is public by design,
 * so real protection is Web3Forms' zero-config hCaptcha — add
 * `<div class="h-captcha" data-captcha="true"></div>` plus their client
 * script (RECIPES recipe 3) and this module refuses to submit without a
 * solved token (Web3Forms verifies it server-side).
 *
 * Wired once in BaseLayout on astro:page-load — a page without a matching
 * form costs nothing.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function fieldError(input: Field, form: HTMLFormElement): string {
  const value = input.value.trim();
  if (value === "") return form.dataset.requiredError ?? "";
  if (input instanceof HTMLInputElement && input.type === "email" && !EMAIL_PATTERN.test(value)) {
    return form.dataset.emailError ?? "";
  }
  return "";
}

function validate(form: HTMLFormElement): boolean {
  let firstInvalid: HTMLElement | null = null;
  for (const input of form.querySelectorAll<Field>(
    "input[required], textarea[required], select[required]",
  )) {
    const message = fieldError(input, form);
    const errorEl = document.getElementById(`${input.id}-error`);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.toggle("hidden", message === "");
    }
    input.setAttribute("aria-invalid", message === "" ? "false" : "true");
    if (message !== "" && !firstInvalid) firstInvalid = input;
  }
  firstInvalid?.focus();
  return firstInvalid === null;
}

function showStatus(form: HTMLFormElement, kind: "success" | "error"): void {
  const status = form.querySelector<HTMLElement>("[data-form-status]");
  if (!status) return;
  status.textContent =
    kind === "success" ? (form.dataset.successMessage ?? "") : (form.dataset.errorMessage ?? "");
  status.classList.remove("hidden");
  status.dataset.state = kind;
}

function hideStatus(form: HTMLFormElement): void {
  const status = form.querySelector<HTMLElement>("[data-form-status]");
  if (!status) return;
  status.textContent = "";
  status.classList.add("hidden");
  delete status.dataset.state;
}

/** Designed CTAs wrap the label in [data-submit-text] so icon markup survives
 *  the sending-state text swap; a plain text button still works unchanged. */
function labelTarget(button: HTMLButtonElement): HTMLElement {
  return button.querySelector<HTMLElement>("[data-submit-text]") ?? button;
}

async function submit(form: HTMLFormElement): Promise<void> {
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
  if (!button) return;
  const label = labelTarget(button);

  button.disabled = true;
  label.textContent = form.dataset.sendingLabel ?? "";
  try {
    const formData = new FormData(form);
    formData.append("access_key", PUBLIC_WEB3FORMS_KEY);
    formData.append("subject", form.dataset.subject ?? "");
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      body: formData,
      headers: { Accept: "application/json" },
      // A hung request must not leave the button stuck on "sending…" forever.
      signal: AbortSignal.timeout(15_000),
    });
    const result: unknown = await response.json();
    const ok =
      typeof result === "object" &&
      result !== null &&
      "success" in result &&
      result.success === true;
    showStatus(form, ok ? "success" : "error");
    if (ok) {
      form.reset();
      trackConversion("generate_lead");
    }
  } catch {
    showStatus(form, "error");
  } finally {
    button.disabled = false;
    label.textContent = form.dataset.submitLabel ?? "";
  }
}

/** "" = widget present but unsolved; null = no captcha on this form. */
function captchaToken(form: HTMLFormElement): string | null {
  if (!form.querySelector(".h-captcha")) return null;
  return (
    form.querySelector<HTMLTextAreaElement>('textarea[name="h-captcha-response"]')?.value ?? ""
  );
}

function bind(form: HTMLFormElement): void {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
    if (button?.disabled) return; // a submission is already in flight
    // Clear any previous outcome first — a stale "sent successfully" must not
    // sit on screen next to fresh validation errors.
    hideStatus(form);
    if (!validate(form)) return;
    if (captchaToken(form) === "") {
      // hCaptcha rendered but not solved — Web3Forms would reject the
      // submission server-side; say so instead of losing the message.
      const status = form.querySelector<HTMLElement>("[data-form-status]");
      if (status) {
        status.textContent = form.dataset.captchaError ?? form.dataset.errorMessage ?? "";
        status.classList.remove("hidden");
        status.dataset.state = "error";
      }
      return;
    }
    if (PUBLIC_WEB3FORMS_KEY === "") {
      // Endpoint not configured — surface the error state instead of a silent no-op.
      showStatus(form, "error");
      return;
    }
    void submit(form);
  });
}

export function setupContactForms(): void {
  const forms = document.querySelectorAll<HTMLFormElement>("form[data-contact-form]");
  if (forms.length > 0 && PUBLIC_WEB3FORMS_KEY === "") {
    console.warn(
      "PUBLIC_WEB3FORMS_KEY is not set — every contact-form submission will show the error " +
        "state. Put the key in .env and rebuild (see docs/PLAYBOOK.md).",
    );
  }
  for (const form of forms) {
    bind(form);
  }
}
