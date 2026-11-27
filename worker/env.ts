export interface SecretBindings {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_JWT_ISSUER?: string;
  CLERK_JWT_AUDIENCE?: string;
  CLERK_ALLOWED_AUTHORIZED_PARTIES?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  /** HMAC key for visitor-report identifiers (worker/gallery.ts); at least 32 characters. */
  SHARE_REPORT_SECRET?: string;
}

export type WorkerEnv = Env & SecretBindings;
