import express, { Request, Response } from "express";
import { auth_router } from "./router/auth.router.js";
import colors from "colors";
import cors from "cors";

import dotenv from "dotenv";
dotenv.config();

import "./db/index.js";
import { User } from "./db/Schema/User.js";
import { profile_router } from "./router/profile.router.js";
import { auth_middleware } from "./middlewares/auth.middleware.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  "http://localhost:8080", // Your local React dev server
  "https://your-frontend-app.onrender.com", // Your deployed frontend
];

const corsOptions = {
  origin: function (origin: any, callback: (...x: any[]) => any) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true, // Allow cookies if you use them for auth
};

app.use(cors(corsOptions));

app.get("/", async (req: Request, res: Response) => {
  // const new_user = await User.build({
  //   fname: "Johnson",
  //   lname: "Eremie",
  //   email: "reremie1@gmail.com",
  //   password: "Aa1!jfhss"
  // })

  // await new_user.save();

  res.send("Hello, World!");
});

app.use("/api/v1/auth", auth_router);

app.use(auth_middleware);
app.use("/api/v1/me", profile_router);

app.listen(PORT, () => {
  console.log(colors.green(`Server is running on http://localhost:${PORT}`));
});
