// JWT configuration.
// In production, JWT_SECRET and JWT_REFRESH_SECRET MUST be set in environment
// variables. The server will refuse to start if they are missing in production.
const isProduction = process.env["NODE_ENV"] === "production";

if (isProduction && (!process.env["JWT_SECRET"] || !process.env["JWT_REFRESH_SECRET"])) {
  throw new Error(
    "JWT_SECRET and JWT_REFRESH_SECRET environment variables must be set in production."
  );
}

export const JWT_CONFIG = {
  accessTokenSecret: process.env["JWT_SECRET"] ?? "cmd-trade-access-dev-only",
  refreshTokenSecret: process.env["JWT_REFRESH_SECRET"] ?? "cmd-trade-refresh-dev-only",
  accessTokenExpiresIn: "15m",
  refreshTokenExpiresIn: "7d",
} as const;
