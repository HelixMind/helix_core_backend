import { IAppEnvs } from "../../core/interfaces/IEnvs.js"

export interface IEnvFactory {
    // Create
    // create: (path?: string) => void
    
    fetch: (id: keyof IAppEnvs) => string|number
}