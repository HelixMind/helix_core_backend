import express, { Request, Response } from "express";
import { auth_router } from "./router/auth.router.js";
import colors from "colors";

import dotenv from "dotenv";
dotenv.config();

import "./db/index.js";
import { User } from "./db/Schema/User.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

app.get('/', async (req: Request, res: Response) => {
  // const new_user = await User.build({
  //   fname: "Johnson",
  //   lname: "Eremie",
  //   email: "reremie1@gmail.com",
  //   password: "Aa1!jfhss"
  // })

  // await new_user.save();

  res.send('Hello, World!');
});

app.use("/api/v1/auth", auth_router);

app.listen(PORT, () => {
  console.log(colors.green(`Server is running on http://localhost:${PORT}`));
});