import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db('blood_donation_db');

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client
  }),
  trustedOrigins: [
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  user: {
    modelName: "users",
    additionalFields: {
      bloodGroup: { type: "string", required: false, input: true },
      district: { type: "string", required: false, input: true },
      upazila: { type: "string", required: false, input: true },
      role: { type: "string", defaultValue: "donor", input: true },
      status: { type: "string", defaultValue: "active", input: true },
      avatar: { type: "string", required: false, input: true }
    }
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_SECRET
    }
  },
  emailAndPassword: {
    enabled: true
  }
});
