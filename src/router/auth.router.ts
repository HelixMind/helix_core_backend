import { Router } from "express";
import { login_controller, signup_controller } from "../controller/auth.controller.js";

const auth_router = Router();

auth_router.post("/login", login_controller);
auth_router.post("/signup", signup_controller);

export {
    auth_router
}