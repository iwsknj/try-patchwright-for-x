import "dotenv/config";
import { authenticator } from "otplib";

export function generateOneTimePassword(secret: string): string {
  try {
    return authenticator.generate(secret);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown error generating OTP";
    throw new Error(`Failed to generate OTP: ${reason}`);
  }
}
