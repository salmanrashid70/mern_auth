export interface RegisterDataObject {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    userAgent?: string;
}

export interface LoginDataObject {
    email: string;
    password: string;
    userAgent?: string;
}

export interface ResetPasswordDataObject {
    password: string;
    verificationCode: string;
}