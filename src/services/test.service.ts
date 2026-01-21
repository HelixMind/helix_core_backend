// --- BIOLOGICAL CONSTANTS --- 
const CARRYING_CAPACITY = 10000; 
const MAX_GROWTH_RATE = 0.35; 

// µ_max (maximum specific growth rate) 
const K_S = 20; 

// Half-saturation constant (Monod) 
const BASE_MUTATION_RATE = 0.005; 
const SELECTION_COEFFICIENT = 0.1; 

export class MicrobeSimulation { 
    private population = 0;
    private timeStep = 0;
    private avgResistance = 0;
    private adaptationLog: string[] = [];
    private growthHistory: {
        time: number, 
        population: number,
    }[] = [];
    private env: {
        temperature: number,
        pH: number,
        nutrients: number,
        oxygen: number,
        antibioticConc: number,
        antibioticOn?: boolean
    } = {
        temperature: 0,
        pH: 0,
        nutrients: 100,
        oxygen: 21,
        antibioticConc: 0,
        antibioticOn: false
    }


    constructor() { this.reset(); } 

    reset() { 
        this.population = 1000; this.timeStep = 0; this.avgResistance = 0.0; // 0.0 to 1.0 (Genetic trait) 
        this.adaptationLog = ['Culture inoculated.']; this.growthHistory = []; 
        this.env = { temperature: 37, pH: 7.0, nutrients: 100, oxygen: 21, antibioticConc: 0, };
    } 
        
    updateEnvironment(updates: typeof this.env) { 
        // Converts UI boolean to Concentration (µg/mL) 
        if (updates.antibioticOn !== undefined) { 
            updates.antibioticConc = updates.antibioticOn ? 50 : 0; 
            delete updates.antibioticOn; 
        } 
        
        this.env = { ...this.env, ...updates }; 
    } 
    
    /** * TEMPERATURE MODEL (Gaussian Curve) * Most enzymes denature quickly above 42-45°C. */ 
    getTemperatureCoeff() { 
        const T = this.env.temperature; 
        const T_opt = 37; 
        const T_max = 46; 
        const T_min = 10; 
        if (T <= T_min || T >= T_max) return 0; 
        
        // Standard bell curve for enzymatic activity 
        const sigma = 5; 
        return Math.exp(-0.5 * Math.pow((T - T_opt) / sigma, 2)); 
    } 
    
    /** * pH MODEL (Parabolic) * Simulates the narrow window of cytoplasmic pH homeostasis. */ 
    getPHCoeff() { 
        const pH = this.env.pH; 
        const pH_opt = 7.0; 
        const pH_width = 2.5; // Range of survival (approx 4.5 to 9.5) 
        
        let coeff = 1 - Math.pow((pH - pH_opt) / pH_width, 2); 
        return Math.max(0, coeff); 
    } 
    
    /** * NUTRIENT KINETICS (Monod Equation) * Growth rate is a function of substrate concentration. */ 
    getNutrientCoeff() { 
        const S = this.env.nutrients; 
        if (S <= 0) return 0; 
        return S / (K_S + S); 
    } 
    
    /** * PHARMACODYNAMICS (Hill Equation) * Kill rate based on concentration and resistance. */ 
    getKillRate() { 
        const dose = this.env.antibioticConc; 
        if (dose <= 0) return 0; // Resistance increases the MIC (Minimum Inhibitory Concentration) 
        
        const MIC = 10 + (this.avgResistance * 90); 
        const n = 2; // Hill coefficient 

        const efficacy = Math.pow(dose, n) / (Math.pow(MIC, n) + Math.pow(dose, n)); 
        return 0.4 * efficacy; // Base kill rate of 40% per tick at high efficacy 
    } 
    
    tick() { 
        this.timeStep += 1; 
        
        // 1. Calculate Growth Factors 
        const tempK = this.getTemperatureCoeff(); 
        const phK = this.getPHCoeff(); 
        const nutrientK = this.getNutrientCoeff(); 
        const oxygenK = this.env.oxygen > 5 ? 1 : 0.2; // Facultative anaerobe model 
        
        // 2. Growth Logic 
        const currentGrowthRate = MAX_GROWTH_RATE * tempK * phK * nutrientK * oxygenK; 
        const logisticFactor = 1 - (this.population / CARRYING_CAPACITY); 
        const growthAmount = this.population * currentGrowthRate * logisticFactor; 
        
        // 3. Death Logic 
        const antibioticKillRate = this.getKillRate(); 
        const deathAmount = this.population * antibioticKillRate; 
        
        // 4. Evolution (Selection Pressure) 
        if (antibioticKillRate > 0.01 && this.population > 0) { 
            // Natural Selection: Survivors pass on resistance 
            const selectionPressure = antibioticKillRate * SELECTION_COEFFICIENT; 
            this.avgResistance = Math.min(1.0, this.avgResistance + selectionPressure); 
            
            if (Math.random() < 0.1) { 
                this.adaptationLog.push( `Step ${this.timeStep}: Selection Pressure → Resistance ${(this.avgResistance * 100).toFixed(1)}%` ); 
            } 
        } 
        
        // 5. Stress-Induced Mutations (SOS Response) 
        const stress = 1 - (tempK * phK); 
        const mutationChance = BASE_MUTATION_RATE * (1 + stress * 5); 
        
        if (Math.random() < mutationChance) { 
            this.avgResistance = Math.min(1.0, this.avgResistance + 0.01); 
            this.adaptationLog.push(`Step ${this.timeStep}: Spontaneous mutation detected.`); 
        } 
        
        // 6. Update Population and Nutrients 
        let nextPop = this.population + growthAmount - deathAmount; 
        
        // Each new bacterium consumes ~0.05 units of nutrient 
        const consumption = growthAmount > 0 ? growthAmount * 0.05 : 0; 
        this.env.nutrients = Math.max(0, this.env.nutrients - consumption); 
        this.population = Math.max(0, Math.round(nextPop)); 
        
        // Log Management 
        if (this.adaptationLog.length > 10) this.adaptationLog.shift(); 
        this.growthHistory.push({ time: this.timeStep, population: this.population, }); 
        
        return this.getState(); 
    } 
    
    getState() { 
        return { 
            population: this.population, 
            timeStep: this.timeStep, 
            resistanceLevel: Math.round(this.avgResistance * 100), 
            growthHistory: this.growthHistory, 
            adaptationLog: this.adaptationLog, 
            stressLevels: { 
                temperature: 1 - this.getTemperatureCoeff(), 
                ph: 1 - this.getPHCoeff(), 
                nutrients: 1 - this.getNutrientCoeff(), 
                resistance: this.avgResistance 
            }, 
            environment: this.env 
        }; 
    } 
} 