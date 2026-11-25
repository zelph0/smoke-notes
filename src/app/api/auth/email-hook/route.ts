// @auth-module: file (deleted by scripts/remove-auth.ts). Auth integration point: email webhook.
import { handleEmailHook } from "@/modules/auth/email/hook";

export function POST(request: Request) {
  return handleEmailHook(request);
}
