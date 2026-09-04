export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || "wTGMPauVZU9E0RrY52frdjmR7oxX9HRB",
  database: mongodbAdapter(db, {
    client,
  }),

  trustedOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "https://blood-donation-seven-rose.vercel.app",
  ],

  user: {
    modelName: "users",

    additionalFields: {
      bloodGroup: {
        type: "string",
        required: false,
        input: true,
      },
      district: {
        type: "string",
        required: false,
        input: true,
      },
      upazila: {
        type: "string",
        required: false,
        input: true,
      },
      role: {
        type: "string",
        defaultValue: "donor",
        input: true,
      },
      status: {
        type: "string",
        defaultValue: "active",
        input: true,
      },
      avatar: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_SECRET,
    },
  },

  emailAndPassword: {
    enabled: true,
  },
});
