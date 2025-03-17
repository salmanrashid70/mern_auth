import { Request, Response } from "express";
import { asyncHandler } from "../../middlewares/asyncHandler";
import { AuthService } from "./auth.service";
import { HTTPSTATUS } from "../../config/http.config";
import { loginSchema, registerSchema } from "../../common/validators/auth.validator";
import { getAccessTokenCookieOptions, getRefreshTokenCookieOptions, setAuthenticationCookieOptions } from "../../common/utls/cookies";
import { UnauthorizedException } from "../../common/utls/catch-errors";

export class AuthController {
    private authService: AuthService;

    constructor(authService: AuthService) {
        this.authService = authService;
    }

    public register = asyncHandler(
        async (req: Request, res: Response): Promise<any> => {
            const body = registerSchema.parse({ ...req.body });

            const { user } = await this.authService.register(body);

            return res.status(HTTPSTATUS.CREATED).json({ message: "User registered successfully", data: user });
        }
    );

    public login = asyncHandler(
        async (req: Request, res: Response): Promise<any> => {
            const body = loginSchema.parse({ ...req.body });

            const { user, accessToken, refreshToken } = await this.authService.login(body);

            return setAuthenticationCookieOptions({
                res,
                accessToken,
                refreshToken,
            }).status(HTTPSTATUS.OK).json({ message: "User login successfully.", user, accessToken, refreshToken });
        }
    );

    public refreshToken = asyncHandler(
        async (req: Request, res: Response): Promise<any> => {
            const refreshToken = req.cookies.refreshToken as string | undefined;

            if (!refreshToken) {
                throw new UnauthorizedException("Missing refresh token.");
            }

            const { accessToken, newRefreshToken } = await this.authService.refreshToken(refreshToken);

            if (newRefreshToken) {
                res.cookie("refreshToken", newRefreshToken, getRefreshTokenCookieOptions());
            }

            return res.status(HTTPSTATUS.OK)
                .cookie("accessToken", accessToken, getAccessTokenCookieOptions())
                .json({ message: "Refresh access token successfully." });
        }
    );
}