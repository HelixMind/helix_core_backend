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
import { send_mail } from "./services/mail.service.js";
import { ResponseSchema } from "./types/index.js";
import { Token } from "./db/Schema/Token.js";
import { generate_otp } from "./services/token.service.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  "http://localhost:8080", // Your local React dev server
  "https://helix-mind.vercel.app", // Your deployed frontend
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
  res.send(`Hello, World! ${generate_otp()}`);
});

app.get("/api/v1/test_mail_service", async (req: Request, res: Response) => {
  try {
    await send_mail("reset-password", ["reremie523@gmail.com", "nzenwatachristopher186@gmail.com", "kidly204@gmail.com"], {
      otp_code: 842931,
      support_mail: "helix@traction3.com"
    });

    res.status(200).json({
      status: "success",
      payload: {
        message: "Mailer working",
      }
    } as ResponseSchema);
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error instanceof Error ? error.message : JSON.stringify(error),
    } as ResponseSchema);
  }
})

app.use("/api/v1/auth", auth_router);

app.use(auth_middleware);
app.use("/api/v1/me", profile_router);

app.listen(PORT, () => {
  console.log(colors.green(`Server is running on http://localhost:${PORT}`));
});
