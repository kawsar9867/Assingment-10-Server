import { betterAuth } from "better-auth";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || "wTGMPauVZU9E0RrY52frdjmR7oxX9HRB",
  baseURL: "https://assingment-10-server.vercel.app",
  trustedOrigins: [
    "https://blood-donation-seven-rose.vercel.app",
    "https://blood-donation.vercel.app",
    "https://assingment-10-server.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
  ],
  user: {
    modelName: "users",
    additionalFields: {
      bloodGroup: { type: "string", required: false, input: true },
      district: { type: "string", required: false, input: true },
      upazila: { type: "string", required: false, input: true },
      role: { type: "string", defaultValue: "donor", input: true },
      status: { type: "string", defaultValue: "active", input: true },
      avatar: { type: "string", required: false, input: true },
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_SECRET,
      redirectURI: "https://assingment-10-server.vercel.app/api/auth/callback/google",
      disableStateCheck: true,
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
    requireEmailVerification: false,
  },
});
