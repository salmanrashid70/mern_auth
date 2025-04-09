import { Request } from "express";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import { BadRequestException, UnauthorizedException } from "../../common/utls/catch-errors";
import { APP_NAME } from "../../common/utls/constants";

export class MfaService {
    public async generateMFASetup(req: Request) {
        const user = req.user;

        if (!user) {
            throw new UnauthorizedException("User not authenticated.");
        }

        if (user.userPreferences.enable2FA) {
            return { message: "MFA already enabled." };
        }

        let secretKey = user.userPreferences.twoFactorSecret;

        if (!secretKey) {
            const secret = speakeasy.generateSecret({ name: APP_NAME });
            secretKey = secret.base32;
            user.userPreferences.twoFactorSecret = secretKey;
            await user.save();
        }

        const url = speakeasy.otpauthURL({ secret: secretKey, label: `${user.name}`, issuer: 'mylebd.com', encoding: "base32" });

        const qrImageUrl = await qrcode.toDataURL(url);

        return {
            message: "Scan the QR code or use the setup key.",
            secret: secretKey,
            qrImageUrl
        };
    }

    public async verifyMFASetup(req: Request, code: string, secretKey: string) {
        const user = req.user;

        if (!user) {
            throw new UnauthorizedException("User not authorized.");
        }

        if (user.userPreferences.enable2FA) {
            return {
                message: "MFA is already enabled.",
                userPreferences: {
                    enable2FA: user.userPreferences.enable2FA
                }
            };
        }

        const isValid = speakeasy.totp.verify({ secret: secretKey, encoding: "base32", token: code });

        if (!isValid) {
            throw new BadRequestException("Invalid MFA code. Please try again.");
        }

        user.userPreferences.enable2FA = true;
        await user.save();

        return {
            message: "MFA setup completed",
            userPreferences: {
                enable2FA: user.userPreferences.enable2FA
            }
        };
    }
}