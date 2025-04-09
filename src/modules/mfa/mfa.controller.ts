import { Request, Response } from "express";
import { asyncHandler } from "../../middlewares/asyncHandler";
import { MfaService } from "./mfa.service";
import { HTTPSTATUS } from "../../config/http.config";
import { verifyMfaSchema } from "../../common/validators/mfa.validator";

export class MfaController {
    private mfaService: MfaService;

    constructor(mfaService: MfaService) {
        this.mfaService = mfaService;
    }

    public generateMFASetup = asyncHandler(
        async (req: Request, res: Response) => {
            const { secret, qrImageUrl, message } = await this.mfaService.generateMFASetup(req);

            return res.status(HTTPSTATUS.OK).json({ message, secret, qrImageUrl });
        }
    );

    public verifyMFASetup = asyncHandler(
        async (req: Request, res: Response) => {
            const { code, secretKey } = verifyMfaSchema.parse({ ...req.body });

            const { userPreferences, message } = await this.mfaService.verifyMFASetup(req, code, secretKey);

            return res.status(HTTPSTATUS.OK).json({ message, userPreferences });
        }

    );
}