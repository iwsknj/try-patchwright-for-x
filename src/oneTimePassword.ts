import "dotenv/config";
import { generateOneTimePassword } from "./util/2fa";

function main() {
  const secret = process.env.X_ACCOUNT_2FA_SECRET;
  if (!secret) {
    throw new Error("X_ACCOUNT_2FA_SECRET is not set");
  }
  const otp = generateOneTimePassword(secret);
  console.log(otp);
}

main();
