import { Request, Response, Router } from "express";
import { login_controller, signup_controller } from "../controller/auth.controller.js";
import { handle_error } from "../utils/error.js";

const auth_router = Router();

auth_router.post("/login", async (req: Request, res: Response) => {
    try {
        await login_controller(req, res);
    } catch (error) {
        handle_error(error, res);
    }
});

auth_router.post("/signup", async (req: Request, res: Response) => {
    try {
        await signup_controller(req, res);
    } catch (error) {
        handle_error(error, res);
    }
});

export {
    auth_router
}