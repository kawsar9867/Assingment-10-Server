const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const stripe = require("stripe");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
// Update CORS middleware to be more permissive for auth routes
app.use(
  cors({
    origin: [
      "https://blood-donation-seven-rose.vercel.app",
      "https://blood-donation.vercel.app",
      "https://assingment-10-server.vercel.app",
      process.env.CLIENT_URL,
      process.env.BETTER_AUTH_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://localhost:5173",
      "http://localhost:5174",
    ].filter(Boolean),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);


// Setup Better Auth Handler placeholders
let authInstance;
let betterAuthHandler;
let client;
let db;
let usersCollection;
let donationRequestsCollection;
let fundsCollection;

let initPromise = null;

async function ensureInitialized() {
  if (betterAuthHandler && db) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (!client) {
        client = new MongoClient(
          process.env.MONGODB_URI || "mongodb://localhost:27017"
        );
      }

      db = client.db("blood_donation_db");
      usersCollection = db.collection("users");
      donationRequestsCollection = db.collection("donationRequests");
      fundsCollection = db.collection("funds");

      console.log("Connected successfully to MongoDB");

      // Ensure Admin Account exists
      try {
        const adminEmail = "kawsarbosuniya52@gmail.com";
        const adminPasswordHash = await bcrypt.hash("kawsar123", 10);
        await usersCollection.updateOne(
          { email: adminEmail },
          {
            $set: {
              email: adminEmail,
              name: "Kawsar Bosuniya (Admin)",
              avatar: "https://i.ibb.co/Mgs9DkB/default-avatar.png",
              bloodGroup: "O+",
              district: "Dhaka",
              upazila: "Dhamrai",
              password: adminPasswordHash,
              role: "admin",
              status: "active",
            },
            $setOnInsert: {
              createdAt: new Date(),
            },
          },
          { upsert: true }
        );
        console.log("Admin account ready.");
      } catch (adminErr) {
        console.warn("Admin check warning:", adminErr.message);
      }

      if (!betterAuthHandler) {
        const { betterAuth } = await import("better-auth");
        const { mongodbAdapter } = await import("better-auth/adapters/mongodb");
        const { toNodeHandler } = await import("better-auth/node");

        const isProduction = Boolean(process.env.VERCEL || process.env.NODE_ENV === "production");
        let serverBaseUrl = process.env.BETTER_AUTH_URL;

        if (!serverBaseUrl || serverBaseUrl.includes("localhost") || process.env.VERCEL) {
          serverBaseUrl = isProduction
            ? "https://assingment-10-server.vercel.app"
            : "http://localhost:5000";
        }

        console.log("Better Auth Base URL configured as:", serverBaseUrl);

        authInstance = betterAuth({
          secret: process.env.BETTER_AUTH_SECRET || "wTGMPauVZU9E0RrY52frdjmR7oxX9HRB",
          baseURL: serverBaseUrl,
          database: mongodbAdapter(db),
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
              disableStateCheck: true,
            },
          },
          emailAndPassword: {
            enabled: true,
            disableSignUp: false,
            requireEmailVerification: false,
          },
          trustedOrigins: [
            "https://blood-donation-seven-rose.vercel.app",
            "https://blood-donation.vercel.app",
            "https://assingment-10-server.vercel.app",
            process.env.CLIENT_URL,
            process.env.BETTER_AUTH_URL,
            process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://localhost:5173",
            "http://localhost:5174",
          ].filter(Boolean),
          advanced: {
            defaultCookieAttributes: {
              sameSite: "none",
              secure: true,
            },
            cors: {
              origin: [
                "https://blood-donation-seven-rose.vercel.app",
                "https://blood-donation.vercel.app",
                "https://assingment-10-server.vercel.app",
                process.env.CLIENT_URL,
                process.env.BETTER_AUTH_URL,
                process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
                "http://localhost:3000",
                "http://localhost:3001",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3001",
                "http://localhost:5173",
                "http://localhost:5174",
              ].filter(Boolean),
              methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
              credentials: true,
            },
          },
        });

        betterAuthHandler = toNodeHandler(authInstance);
        console.log("Better Auth initialized successfully");
      }
    } catch (error) {
      console.error("Initialization error:", error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

// Global initialization middleware
app.use(async (req, res, next) => {
  try {
    await ensureInitialized();
    next();
  } catch (err) {
    console.error("Global init error:", err);
    res.status(500).json({ error: "Server initialization error", details: err.message });
  }
});

// Better Auth middleware
app.use("/api/auth", async (req, res, next) => {
  try {
    await ensureInitialized();
    if (betterAuthHandler) {
      return betterAuthHandler(req, res, next);
    }
    res.status(503).json({ message: "Auth service initializing..." });
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(500).json({ error: "Auth handler error", details: err.message });
  }
});

app.use(express.json());

// Stripe init
const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

// Start server locally if not on Vercel
if (!process.env.VERCEL) {
  ensureInitialized().then(() => {
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  }).catch(console.error);
}

// Export for Vercel Serverless
module.exports = app;

// Better Auth Session Middleware

const verifyToken = async (req, res, next) => {
  try {
    if (!authInstance) {
      return res.status(503).send({ message: "Auth service not ready yet" });
    }

    const session = await authInstance.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return res.status(401).send({ message: "Unauthorized access" });
    }

    req.decoded = {
      id: session.user.id,

      email: session.user.email,
    };

    req.user = session.user;

    next();
  } catch (error) {
    console.error("verifyToken error:", error);

    return res.status(403).send({ message: "Forbidden access" });
  }
};

// Admin Verification Middleware

const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;

  const user = await usersCollection.findOne({ email });

  if (!user || user.role !== "admin") {
    return res.status(403).send({ message: "Forbidden: Admin access only" });
  }

  next();
};

// Admin or Volunteer Verification Middleware

const verifyAdminOrVolunteer = async (req, res, next) => {
  const email = req.decoded.email;

  const user = await usersCollection.findOne({ email });

  if (!user || (user.role !== "admin" && user.role !== "volunteer")) {
    return res
      .status(403)
      .send({ message: "Forbidden: Admin or Volunteer access only" });
  }

  next();
};

// --- AUTH API ---

// User Registration
app.post("/api/auth/register", async (req, res) => {
  const { email, name, avatar, bloodGroup, district, upazila, password, role } =
    req.body;

  if (!email || !name || !bloodGroup || !district || !upazila || !password) {
    return res.status(400).send({ message: "All fields are required" });
  }

  try {
    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .send({ message: "User already exists with this email" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const validRole =
      role && ["donor", "volunteer", "admin"].includes(role) ? role : "donor";

    const newUser = {
      email,
      name,
      avatar: avatar || "https://i.ibb.co/Mgs9DkB/default-avatar.png",
      bloodGroup,
      district,
      upazila,
      password: hashedPassword,
      role: validRole,
      status: "active",
      createdAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);

    // Create token
    const token = jwt.sign(
      { id: result.insertedId, email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(201).send({
      token,
      user: {
        id: result.insertedId,
        email,
        name,
        avatar: newUser.avatar,
        bloodGroup,
        district,
        upazila,
        role: validRole,
        status: "active",
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Server error during registration" });
  }
});

// User Login

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send({ message: "Email and password are required" });
  }

  try {
    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.status(400).send({ message: "Invalid credentials" });
    }

    // Check password

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).send({ message: "Invalid credentials" });
    }

    // Create token

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.send({
      token,

      user: {
        id: user._id,

        email: user.email,

        name: user.name,

        avatar: user.avatar,

        bloodGroup: user.bloodGroup,

        district: user.district,

        upazila: user.upazila,

        role: user.role,

        status: user.status,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).send({ message: "Server error during login" });
  }
});

// User Google Login

app.post("/api/auth/google-login", async (req, res) => {
  const { email, name, avatar } = req.body;

  if (!email || !name) {
    return res.status(400).send({ message: "Email and name are required" });
  }

  try {
    let user = await usersCollection.findOne({ email });

    if (!user) {
      // Create new user for Google login with default fields

      const hashedPassword = await bcrypt.hash(
        Math.random().toString(36).substring(2, 10),
        10,
      );

      const newUser = {
        email,

        name,

        avatar: avatar || "https://i.ibb.co/Mgs9DkB/default-avatar.png",

        bloodGroup: "A+", // Default

        district: "Dhaka", // Default

        upazila: "Dhamrai", // Default

        password: hashedPassword,

        role: "donor",

        status: "active",

        createdAt: new Date(),
      };

      const result = await usersCollection.insertOne(newUser);

      user = {
        _id: result.insertedId,

        ...newUser,
      };
    }

    // Create token

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.send({
      token,

      user: {
        id: user._id,

        email: user.email,

        name: user.name,

        avatar: user.avatar,

        bloodGroup: user.bloodGroup,

        district: user.district,

        upazila: user.upazila,

        role: user.role,

        status: user.status,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).send({ message: "Server error during Google login" });
  }
});

// Get Logged In User Profile

app.get("/api/users/profile", verifyToken, async (req, res) => {
  try {
    const email = req.decoded.email;

    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    // Don't send back password

    const { password, ...safeUser } = user;

    res.send(safeUser);
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});

// Update Logged In User Profile

app.put("/api/users/profile", verifyToken, async (req, res) => {
  try {
    const email = req.decoded.email;

    const { name, avatar, bloodGroup, district, upazila } = req.body;

    const updateDoc = {
      $set: {
        name,

        avatar,

        bloodGroup,

        district,

        upazila,
      },
    };

    const result = await usersCollection.updateOne({ email }, updateDoc);

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    const updatedUser = await usersCollection.findOne({ email });

    const { password, ...safeUser } = updatedUser;

    res.send(safeUser);
  } catch (error) {
    res.status(500).send({ message: "Server error during profile update" });
  }
});

// --- ADMIN USERS API ---

// Get All Users (Admin only, supports status filtering)

app.get("/api/users", async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    const skipIndex = (parseInt(page) - 1) * parseInt(limit);

    const total = await usersCollection.countDocuments(query);

    const users = await usersCollection
      .find(query)

      .project({ password: 0 })

      .skip(skipIndex)

      .limit(parseInt(limit))

      .toArray();

    res.send({
      users,

      total,

      page: parseInt(page),

      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});

// Block/Unblock user (Admin only)

app.patch(
  "/api/users/:id/status",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { status } = req.body; // 'active' or 'blocked'

      if (status !== "active" && status !== "blocked") {
        return res.status(400).send({ message: "Invalid status" });
      }

      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };

      const updateDoc = { $set: { status } };

      const result = await usersCollection.updateOne(filter, updateDoc);

      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "User not found" });
      }

      res.send({ message: `User status updated to ${status}` });
    } catch (error) {
      res.status(500).send({ message: "Server error" });
    }
  },
);

// Change user role (Admin only)

app.patch("/api/users/:id/role", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { role } = req.body; // 'donor', 'volunteer', 'admin'

    if (role !== "donor" && role !== "volunteer" && role !== "admin") {
      return res.status(400).send({ message: "Invalid role" });
    }

    const id = req.params.id;

    const filter = { _id: new ObjectId(id) };

    const updateDoc = { $set: { role } };

    const result = await usersCollection.updateOne(filter, updateDoc);

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    res.send({ message: `User role updated to ${role}` });
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});

// --- DONOR SEARCH API (Public) ---

app.get("/api/donors/search", async (req, res) => {
  try {
    const { bloodGroup, district, upazila } = req.query;

    // Check if search parameters are provided

    if (!bloodGroup || !district || !upazila) {
      return res
        .status(400)
        .send({ message: "Blood group, district, and upazila are required" });
    }

    const query = {
      bloodGroup,

      district,

      upazila,

      status: "active", // Only search active donors
    };

    const donors = await usersCollection
      .find(query)

      .project({ password: 0, role: 0 })

      .toArray();

    res.send(donors);
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});

// --- DONATION REQUESTS API ---

// Create Donation Request (Private, active users only)

app.post("/api/donation-requests", verifyToken, async (req, res) => {
  try {
    const email = req.decoded.email;

    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    if (user.status === "blocked") {
      return res.status(403).send({
        message: "Blocked users cannot create blood donation requests",
      });
    }

    const {
      recipientName,

      recipientDistrict,

      recipientUpazila,

      hospitalName,

      fullAddress,

      bloodGroup,

      donationDate,

      donationTime,

      requestMessage,
    } = req.body;

    const newRequest = {
      requesterName: user.name,

      requesterEmail: user.email,

      recipientName,

      recipientDistrict,

      recipientUpazila,

      hospitalName,

      fullAddress,

      bloodGroup,

      donationDate: new Date(donationDate),

      donationTime,

      requestMessage,

      status: "pending",

      donorName: null,

      donorEmail: null,

      createdAt: new Date(),
    };

    const result = await donationRequestsCollection.insertOne(newRequest);

    res.status(201).send({
      message: "Donation request created successfully",
      requestId: result.insertedId,
    });
  } catch (error) {
    console.error(error);

    res.status(500).send({ message: "Server error" });
  }
});

// Get Public Donation Requests (Only pending)

app.get("/api/donation-requests", async (req, res) => {
  try {
    const requests = await donationRequestsCollection
      .find({ status: "pending" })
      .toArray();

    res.send(requests);
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});

// Get Logged In User's Donation Requests (Private, supports pagination and filtering)

app.get("/api/donation-requests/my", verifyToken, async (req, res) => {
  try {
    const email = req.decoded.email;

    const { status, page = 1, limit = 10, recent = "false" } = req.query;

    const query = { requesterEmail: email };

    if (status) {
      query.status = status;
    }

    if (recent === "true") {
      // Return 3 recent requests, no pagination needed

      const requests = await donationRequestsCollection
        .find(query)

        .sort({ createdAt: -1 })

        .limit(3)

        .toArray();

      return res.send(requests);
    }

    const skipIndex = (parseInt(page) - 1) * parseInt(limit);

    const total = await donationRequestsCollection.countDocuments(query);

    const requests = await donationRequestsCollection
      .find(query)

      .sort({ createdAt: -1 })

      .skip(skipIndex)

      .limit(parseInt(limit))

      .toArray();

    res.send({
      requests,

      total,

      page: parseInt(page),

      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});

// Get All Donation Requests (Private, Admin/Volunteer only, supports pagination and filtering)

app.get(
  "/api/donation-requests/all",
  verifyToken,
  verifyAdminOrVolunteer,
  async (req, res) => {
    try {
      const { status, page = 1, limit = 10 } = req.query;

      const query = {};

      if (status) {
        query.status = status;
      }

      const skipIndex = (parseInt(page) - 1) * parseInt(limit);

      const total = await donationRequestsCollection.countDocuments(query);

      const requests = await donationRequestsCollection
        .find(query)

        .sort({ createdAt: -1 })

        .skip(skipIndex)

        .limit(parseInt(limit))

        .toArray();

      res.send({
        requests,

        total,

        page: parseInt(page),

        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      res.status(500).send({ message: "Server error" });
    }
  },
);

// Get Specific Donation Request Details (Private)

app.get("/api/donation-requests/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid ID format" });
    }

    const request = await donationRequestsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!request) {
      return res.status(404).send({ message: "Request not found" });
    }

    res.send(request);
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});

// Update Donation Request (Private, Owner or Admin/Volunteer only)

app.put("/api/donation-requests/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;

    const email = req.decoded.email;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid ID format" });
    }

    // Check user role

    const user = await usersCollection.findOne({ email });

    const request = await donationRequestsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!request) {
      return res.status(404).send({ message: "Request not found" });
    }

    // Only creator or admin/volunteer can edit

    if (
      request.requesterEmail !== email &&
      user.role !== "admin" &&
      user.role !== "volunteer"
    ) {
      return res.status(403).send({
        message: "Forbidden: You do not have permission to update this request",
      });
    }

    const {
      recipientName,

      recipientDistrict,

      recipientUpazila,

      hospitalName,

      fullAddress,

      bloodGroup,

      donationDate,

      donationTime,

      requestMessage,
    } = req.body;

    const updateDoc = {
      $set: {
        recipientName,

        recipientDistrict,

        recipientUpazila,

        hospitalName,

        fullAddress,

        bloodGroup,

        donationDate: new Date(donationDate),

        donationTime,

        requestMessage,
      },
    };

    await donationRequestsCollection.updateOne(
      { _id: new ObjectId(id) },
      updateDoc,
    );

    res.send({ message: "Donation request updated successfully" });
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});

// Delete Donation Request (Private, Owner or Admin only)

app.delete("/api/donation-requests/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;

    const email = req.decoded.email;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid ID format" });
    }

    const user = await usersCollection.findOne({ email });

    const request = await donationRequestsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!request) {
      return res.status(404).send({ message: "Request not found" });
    }

    // Only creator or admin can delete

    if (request.requesterEmail !== email && user.role !== "admin") {
      return res.status(403).send({
        message: "Forbidden: You do not have permission to delete this request",
      });
    }

    await donationRequestsCollection.deleteOne({ _id: new ObjectId(id) });

    res.send({ message: "Donation request deleted successfully" });
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});

app.patch(
  "/api/donation-requests/:id/status",
  verifyToken,
  async (req, res) => {
    try {
      const id = req.params.id;

      const { status } = req.body; // 'pending', 'inprogress', 'done', 'canceled'

      const email = req.decoded.email;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid ID format" });
      }

      const request = await donationRequestsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!request) {
        return res.status(404).send({ message: "Request not found" });
      }

      const user = await usersCollection.findOne({ email });

      let updateDoc = { $set: { status } };

      if (status === "inprogress") {
        if (request.status !== "pending") {
          return res
            .status(400)
            .send({ message: "Request is no longer pending" });
        }

        updateDoc.$set.donorName = user.name;

        updateDoc.$set.donorEmail = user.email;
      } else if (status === "done" || status === "canceled") {
        // Requester, assigned donor, admin or volunteer can change status

        const isAuthorized =
          request.requesterEmail === email ||
          request.donorEmail === email ||
          user.role === "admin" ||
          user.role === "volunteer";

        if (!isAuthorized) {
          return res.status(403).send({ message: "Forbidden" });
        }
      } else {
        // Admin/Volunteer can change to pending, etc.

        if (user.role !== "admin" && user.role !== "volunteer") {
          return res.status(403).send({ message: "Forbidden" });
        }
      }

      await donationRequestsCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc,
      );

      res.send({ message: `Donation status updated to ${status}` });
    } catch (error) {
      res.status(500).send({ message: "Server error" });
    }
  },
);

// Create PaymentIntent

app.post("/api/funding/pay", verifyToken, async (req, res) => {
  try {
    const { amount } = req.body; // Amount in USD

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).send({ message: "Invalid amount" });
    }

    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: amountInCents,

      currency: "usd",

      payment_method_types: ["card"],
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error(error);

    res.status(500).send({ message: "Failed to create payment intent" });
  }
});

// Save successful payment/funding

app.post("/api/funding/confirm", verifyToken, async (req, res) => {
  try {
    const { amount, transactionId } = req.body;

    const email = req.decoded.email;

    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    const newFund = {
      userName: user.name,

      userEmail: user.email,

      amount: parseFloat(amount),

      date: new Date(),

      transactionId,
    };

    const result = await fundsCollection.insertOne(newFund);

    res.status(201).send({
      message: "Funding successfully recorded",
      fundId: result.insertedId,
    });
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});

// Get funding history (Private)

app.get("/api/funding", verifyToken, async (req, res) => {
  try {
    const funds = await fundsCollection.find().sort({ date: -1 }).toArray();

    res.send(funds);
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});

// --- STATS API (Admin & Volunteer dashboard) ---

app.get("/api/stats", verifyToken, verifyAdminOrVolunteer, async (req, res) => {
  try {
    const totalUser = await usersCollection.countDocuments();

    const totalRequest = await donationRequestsCollection.countDocuments();

    // Calculate total funding

    const fundingData = await fundsCollection
      .aggregate([{ $group: { _id: null, totalAmount: { $sum: "$amount" } } }])
      .toArray();

    const totalFunding =
      fundingData.length > 0 ? fundingData[0].totalAmount : 0;

    res.send({
      totalUser,

      totalFunding,

      totalRequest,
    });
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});

// Root Route

app.get("/", (req, res) => {
  res.send({ message: "Blood Donation Platform API is running." });
});

// Error handling middleware

app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).send({ message: "Internal server error occurred" });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
