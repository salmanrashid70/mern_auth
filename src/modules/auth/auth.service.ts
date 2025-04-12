import { ErrorCode } from "../../common/enums/error-code.enum";
import { VerificationEnum } from "../../common/enums/verification-code.enum";
import { LoginDataObject, RegisterDataObject, ResetPasswordDataObject } from "../../common/interface/auth.interface";
import { hashValue } from "../../common/utls/bcrypt";
import { BadRequestException, HttpException, InternalServerError, NotFoundException, UnauthorizedException } from "../../common/utls/catch-errors";
import { anHourFromNow, calculateExpirationDate, fortyFiveMinutesFromNow, ONE_DAY_IN_MS, threeMinutesAgo } from "../../common/utls/date-time";
import { RefreshTokenPayload, refreshTokenSignOptions, signJwtToken, verifyJwtToken } from "../../common/utls/jwt";
import { config } from "../../config/app.config";
import { HTTPSTATUS } from "../../config/http.config";
import SessionModel from "../../database/models/session.model";
import UserModel from "../../database/models/user.model";
import VerificationCodeModel from "../../database/models/verification.model";
import { sendEmail } from "../../mailers/mailer";
import { passwordResetTemplate, verifyEmailTemplate } from "../../mailers/templates/template";


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

        const verificationUrl = `${config.APP_ORIGIN}/confirm-account?code=${verification.code}`;

        await sendEmail({ to: newUser.email, ...verifyEmailTemplate(verificationUrl) });

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
        if (user.userPreferences.enable2FA) {
            return {
                user: null,
                mfaRequired: true,
                accessToken: "",
                refreshToken: "",
            };
        }

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
        const user = await UserModel.findOne({ email });

        if (!user) {
            throw new BadRequestException("User not found.");
        }

        const isThreeMinutesAgo = threeMinutesAgo();
        const maxAttempts = 2;

        const mailCount = await VerificationCodeModel.countDocuments({
            userId: user.id, type: VerificationEnum.PASSWORD_RESET, createdAt: { $gt: isThreeMinutesAgo }
        });

        if (mailCount >= maxAttempts) {
            throw new HttpException("Too many request, try again later.", HTTPSTATUS.TOO_MANY_REQUESTS, ErrorCode.AUTH_TOO_MANY_ATTEMPTS);
        }

        const expiresAt = anHourFromNow();

        const verificationCode = await VerificationCodeModel.create({ userId: user.id, type: VerificationEnum.PASSWORD_RESET, expiresAt });

        const resetPasswordLink = `${config.APP_ORIGIN}/reset-password?code=${verificationCode.code}&exp=${expiresAt.getTime()}`;

        const { data, error } = await sendEmail({ to: user.email, ...passwordResetTemplate(resetPasswordLink) });

        console.log(data, error);

        if (!data?.id) {
            throw new InternalServerError(`${error?.name} ${error?.message}`);
        }

        return { url: resetPasswordLink, emailId: data.id };
    }

    public async resetPassword({ password, verificationCode }: ResetPasswordDataObject) {
        const validCode = await VerificationCodeModel.findOne({
            code: verificationCode,
            type: VerificationEnum.PASSWORD_RESET,
            expiresAt: { $gt: new Date() },
        });

        if (!validCode) {
            throw new NotFoundException("Invalid or expired verification code.");
        }

        const hashedPassword = await hashValue(password);

        const updatedUser = await UserModel.findByIdAndUpdate(validCode.userId, { password: hashedPassword });

        if (!updatedUser) {
            throw new BadRequestException("Failed to reset password.");
        }

        await validCode.deleteOne();

        await SessionModel.deleteMany({ userId: updatedUser.id });

        return { user: updatedUser };
    }

    public async logout(sessionId: string) {
        return await SessionModel.findByIdAndDelete(sessionId);
    }
}