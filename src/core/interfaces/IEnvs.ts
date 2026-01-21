export interface IAppEnvs {
    PORT: string;
    DATABASE_URL: string;
    JWT_SECRET: string;
    NODE_ENV: 'development' | 'production' | 'test';
    PASSWORD_HASH_SALT: string|number
}