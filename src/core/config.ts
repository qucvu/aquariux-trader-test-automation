export const config = {
    web: {
        baseUrl: process.env.WEB_APP_URL ?? '',
        userAccountId: process.env.USER_ACCOUNT_ID ?? '',
        userPassword: process.env.USER_PASSWORD ?? '',
    },
} as const;

export function assertConfig(): void {
    const { baseUrl, userAccountId, userPassword } = config.web;
    const required = {
        WEB_APP_URL: baseUrl,
        USER_ACCOUNT_ID: userAccountId,
        USER_PASSWORD: userPassword,
    };

    const missing = Object.entries(required)
        .filter(([, value]) => value.trim() === '')
        .map(([key]) => key);

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variable(s): ${missing.join(', ')}. ` +
            'Set them in your environment or use .env.example as a template.',
        );
    }

    if (!/^https?:\/\//i.test(baseUrl.trim()) || !URL.canParse(baseUrl)) {
        throw new Error('WEB_APP_URL must be a valid HTTP or HTTPS URL.');
    }
}
