import { IAppEnvs } from "../../core/interfaces/IEnvs.js";
import { IEnvFactory } from "./IEnvFactory.js";
import { config } from "dotenv";

export class EnvFactory {
    private static instance: EnvFactory|null = null

    private envs: IAppEnvs|null = null;

    private constructor (path?: string) {
        // console.log(process.env);

        if (!path) {
            config()
        } else {
            config({
                path
            });
        }

        this.envs = process.env as unknown as IAppEnvs
    }

    static create(path?: string) {
        if (!EnvFactory.instance) {
            EnvFactory.instance = new EnvFactory();
        }
    };

    static fetch(id: keyof IAppEnvs): string|number {
        if (!EnvFactory.instance) {
            EnvFactory.create();
        }

        if (!EnvFactory.instance!.envs) throw new Error("No env loaded");

        if (EnvFactory.instance!.envs[id]) return EnvFactory.instance!.envs[id];
        throw new Error("Env variable not found!");
    };
}

