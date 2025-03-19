import { ErrorCode } from "../../common/enums/error-code.enum";
import { VerificationEnum } from "../../common/enums/verification-code.enum";
import { LoginDataObject, RegisterDataObject } from "../../common/interface/auth.interface";
import { BadRequestException, UnauthorizedException } from "../../common/utls/catch-errors";
import { calculateExpirationDate, fortyFiveMinutesFromNow, ONE_DAY_IN_MS } from "../../common/utls/date-time";
import { RefreshTokenPayload, refreshTokenSignOptions, signJwtToken, verifyJwtToken } from "../../common/utls/jwt";
import { config } from "../../config/app.config";
import SessionModel from "../../database/models/session.model";
import UserModel from "../../database/models/user.model";
import VerificationCodeModel from "../../database/models/verification.model";
import { sendEmail } from "../../mailers/mailer";
import { verifyEmailTemplate } from "../../mailers/templates/template";


export class AuthService {
    public async register(registerData: RegisterDataObject) {
        const { name, email, password } = registerData;

        const existingUser = await UserModel.findOne({ email });

        if (existingUser) {
            throw new BadRequestException("User already exists with this email", ErrorCode.AUTH_EMAIL_ALREADY_EXISTS);
        }

        const newUser = await UserModel.create({ name, email, password });

        const userId = newUser._id;

        const verification = await VerificationCodeModel.create({
            userId,
            type: VerificationEnum.EMAIL_VERIFICATION,
            expiresAt: fortyFiveMinutesFromNow()
        });


        // TODO: Send verification email link
        const verificationUrl = `${config.APP_ORIGIN}/confirm-account?code=${verification.code}`;

        await sendEmail({
            to: newUser.email,
            ...verifyEmailTemplate(verificationUrl),
        });

        return { user: newUser };
    }

    public async login(loginData: LoginDataObject) {
        const { email, password, userAgent } = loginData;

        const user = await UserModel.findOne({ email });

        if (!user) {
            throw new BadRequestException("Invalid email or password.", ErrorCode.AUTH_USER_NOT_FOUND);
        }

        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            throw new BadRequestException("Invalid email or password.", ErrorCode.AUTH_USER_NOT_FOUND);
        }

        // TODO Check if the user enable 2fa return user as null


        const session = await SessionModel.create({ userId: user.id, userAgent });

        const accessToken = signJwtToken({ userId: user.id, sessionId: session.id });
        const refreshToken = signJwtToken({ sessionId: session.id }, refreshTokenSignOptions);

        return { user, accessToken, refreshToken };
    }

    public async refreshToken(refreshToken: string) {
        const { payload } = verifyJwtToken<RefreshTokenPayload>(refreshToken, { secret: refreshTokenSignOptions.secret });

        if (!payload) {
            throw new UnauthorizedException("Invalid refresh token");
        }

        const session = await SessionModel.findById(payload.sessionId);

        if (!session) {
            throw new UnauthorizedException("Session does not exist.");
        }

        const now = Date.now();

        if (session.expiredAt.getTime() <= now) {
            throw new UnauthorizedException("Session expired.");
        }

        const sessionRequireRefresh = session.expiredAt.getTime() - now <= ONE_DAY_IN_MS;

        if (sessionRequireRefresh) {
            session.expiredAt = calculateExpirationDate(config.JWT.REFRESH_EXPIRES_IN);
            await session.save();
        }

        const newRefreshToken = sessionRequireRefresh ? signJwtToken({ sessionId: session.id }, refreshTokenSignOptions) : undefined;

        const accessToken = signJwtToken({ userId: session.userId, sessionId: session.id });

        return { accessToken, newRefreshToken };
    }

    public async verifyEmail(code: string) {
        const validCode = await VerificationCodeModel.findOne({ code: code, type: VerificationEnum.EMAIL_VERIFICATION, expiresAt: { $gt: new Date() } });

        if (!validCode) {
            throw new BadRequestException("Invalid or expired verification code.");
        }

        const updatedUser = await UserModel.findByIdAndUpdate(validCode.userId, { isEmailVerified: true }, { new: true });

        if (!updatedUser) {
            throw new BadRequestException("Unable to verify email address.", ErrorCode.VALIDATION_ERROR);
        }

        await validCode.deleteOne();

        return { user: updatedUser };
    }

    public async forgotPassword(email: string) {

    }
}