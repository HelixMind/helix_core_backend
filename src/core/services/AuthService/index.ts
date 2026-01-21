import { compareSync, hashSync } from "bcryptjs";
import { CreateUserInput, UserSafe } from "../../interfaces/User.js";
import { IAuthService } from "./IAuthService.js";
import { EnvFactory } from "../../../configs/EnvFactory/index.js";
import { IUserService } from "../UserService/IUserService.js";
import { throw_custom_error } from "../../../utils/error.js";
import { sign, verify } from "jsonwebtoken";
import { CleaningUtils } from "../../../utils/cleaner.js";

export class AuthService implements IAuthService {
  private userService: IUserService | null = null;

  constructor(userService: IUserService) {
    this.userService = userService;
  }

  checkServiceRegistered(): never | void {
    if (!this.userService) throw new Error("No user service registered"); // Use custom errors
  }

  async register(user: CreateUserInput) {
    try {
      this.checkServiceRegistered();

      // Hash password
      user = {
        ...user,
        password: hashSync(
          user.password,
          EnvFactory.fetch("PASSWORD_HASH_SALT")
        ),
      };

      // Create user
      this.userService?.createUser(user);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw_custom_error("Unable to create user", 500);
      throw new Error();
    }
  }

  async login(email: string, password: string) {
    try {
      const user = await this.userService?.getByEmail(email);

      // Check for user
      if (!user) {
        // To Do: Better Error Handling
        throw_custom_error("Invalid email or password", 401);
        throw new Error();
      }

      // Verify Password
      if (compareSync(password, user.password)) {
        // To Do: Better Error Handling
        // To Do: Confirm error code for unauthenticated
        throw_custom_error("Invalid email or password", 401);
        throw new Error();
      }

      // Create token
      const token = sign(
        {
          id: user.id,
        },
        EnvFactory.fetch("JWT_SECRET") as string,
        { expiresIn: "2h" }
      );

      return { token, user: CleaningUtils.convertToSafeUser(user) };
    } catch (error: any) {
      if (error instanceof Error) {
        throw error;
      }

      throw_custom_error("Unable to log user in", 500);
      throw new Error();
    }
  }

  async verifyUser(token: string) {
    try {
      const userId = verify(
        token,
        EnvFactory.fetch("JWT_SECRET") as string
      );
      
      const parsedUserId = (typeof userId == "string" ? JSON.parse(userId) : userId) as unknown as {
        id: string
      };
      
      const user = await this.userService?.getById(parsedUserId.id);

      if (!user) throw new Error();

      return {
        isVerified: true,
        user: CleaningUtils.convertToSafeUser(user)
      }
    } catch (error) {
      // To Do: Better Error Handling
      // To Do: Confirm error code for unauthenticated
      if (error instanceof Error) {
        throw error;
      }

      throw_custom_error("Unable to verify user", 500);
      throw new Error();
    }
  }
}
