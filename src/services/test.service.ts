import { Request, Response } from "express";

// const express = require('express');
// const cors = require('cors');
// const app = express();
// const PORT = 5001;

// app.use(cors());
// app.use(express.json({ limit: '50mb' }));

// Standard Genetic Code for synonymous mutation checking
export const CODON_MAP: Record<string, string> = {
    'ATA':'I', 'ATC':'I', 'ATT':'I', 'ATG':'M', 'ACA':'T', 'ACC':'T', 'ACG':'T', 'ACT':'T',
    'AAC':'N', 'AAT':'N', 'AAA':'K', 'AAG':'K', 'AGC':'S', 'AGT':'S', 'AGA':'R', 'AGG':'R',
    'CTA':'L', 'CTC':'L', 'CTG':'L', 'CTT':'L', 'CCA':'P', 'CCC':'P', 'CCG':'P', 'CCT':'P',
    'CAC':'H', 'CAT':'H', 'CAA':'Q', 'CAG':'Q', 'CGA':'R', 'CGC':'R', 'CGG':'R', 'CGT':'R',
    'GTA':'V', 'GTC':'V', 'GTG':'V', 'GTT':'V', 'GCA':'A', 'GCC':'A', 'GCG':'A', 'GCT':'A',
    'GAC':'D', 'GAT':'D', 'GAA':'E', 'GAG':'E', 'GGA':'G', 'GGC':'G', 'GGG':'G', 'GGT':'G',
    'TCA':'S', 'TCC':'S', 'TCG':'S', 'TCT':'S', 'TTC':'F', 'TTT':'F', 'TTA':'L', 'TTG':'L',
    'TAC':'Y', 'TAT':'Y', 'TAA':'', 'TAG':'', 'TGC':'C', 'TGT':'C', 'TGA':'_', 'TGG':'W',
};

export class SeededRandom {
    private seed: number = 0;

    constructor(seed: number) { this.seed = seed; }

    next(): number {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
}

// 1. IMPROVED FITNESS: Checks for Synonymous vs Missense
export const calculateFitness = (seq: string, mutations: {type: "substitution" | "insertion" | "deletion", context: "coding" | "non-coding", aminoAcidChange: string}[]) => {
    let fitness = 100;
    
    mutations.forEach(m => {
        if (m.type === 'substitution' && m.context === 'coding') {
            // Non-synonymous (Missense) is penalized, Synonymous (Silent) is not
            if (m.aminoAcidChange && m.aminoAcidChange !== 'none') fitness -= 1.5;
        } else if (m.type === 'insertion' || m.type === 'deletion') {
            // Frameshifts are devastating
            fitness -= 10.0;
        }
    });

    // Penalize stop codons
    const stopCodons = ['TAA', 'TAG', 'TGA'];
    for (let i = 0; i < seq.length - 2; i += 3) {
        if (stopCodons.includes(seq.substr(i, 3))) fitness -= 5;
    }
    return Math.max(0, fitness);
};

// 2. KIMURA 2-PARAMETER MODEL: Transitions vs Transversions
export const getMutatedBase = (original: string, rng: SeededRandom) => {
    const transitions: Record<string, string> = { 'A': 'G', 'G': 'A', 'C': 'T', 'T': 'C' };
    const transversions: Record<string, string[]> = { 
        'A': ['C', 'T'], 'G': ['C', 'T'], 'C': ['A', 'G'], 'T': ['A', 'G'] 
    };
    
    // Transitions are statistically ~2x more likely in nature
    if (rng.next() < 0.66) { 
        return transitions[original];
    } else {
        const choices = transversions[original];
        return choices[Math.floor(rng.next() * choices.length)];
    }
};

// app.post('/api/simulate', (req: Request, res: Response) => {
//     const { sequence, params } = req.body;
//     const rng = new SeededRandom(params.seed || Date.now());
    
//     // 3. ENVIRONMENTAL LINKAGE: Temperature affects mutation rate (Arrhenius-like scaling)
//     const tempCelsius = params.tempUnit === 'F' ? (params.temperature - 32) * 5/9 : params.temperature;
//     const tempFactor = Math.pow(1.1, (tempCelsius - 37) / 5); 
//     const effectiveSubRate = params.substitutionRate * tempFactor;

//     let currentSeq = sequence;
//     const allMutations: {
//         generation: number,
//         position: number,
//         type: "insertion" | "deletion" | "substitution",
//         original: any,
//         mutated: string,
//         aminoAcidChange: string,
//         context: 'coding' | 'non-coding'
//     }[] = [];
//     const fitnessHistory = [];

//     for (let gen = 1; gen <= params.numGenerations; gen++) {
//         const seqArray = currentSeq.split('');

//         for (let i = 0; i < currentSeq.length; i++) {
//             if (rng.next() < effectiveSubRate) {
//                 const originalBase = seqArray[i];
//                 const newBase = getMutatedBase(originalBase, rng);
                
//                 // Determine Amino Acid Change
//                 let aaChange = 'none';
//                 const codonStart = Math.floor(i / 3) * 3;
//                 const originalCodon: string = currentSeq.substr(codonStart, 3);
//                 if (originalCodon.length === 3) {
//                     const tempCodon = originalCodon.split('');
//                     tempCodon[i % 3] = newBase;
//                     const newCodon: string = tempCodon.join('');
//                     if (CODON_MAP[originalCodon] !== CODON_MAP[newCodon]) {
//                         aaChange = `${CODON_MAP[originalCodon]}->${CODON_MAP[newCodon]}`;
//                     }
//                 }

//                 seqArray[i] = newBase;
//                 allMutations.push({
//                     generation: gen, position: i, type: 'substitution',
//                     original: originalBase, mutated: newBase, 
//                     aminoAcidChange: aaChange,
//                     context: i < currentSeq.length - 100 ? 'coding' : 'non-coding'
//                 });
//             }
//         }
//         currentSeq = seqArray.join('');
//         fitnessHistory.push({ generation: gen, fitness: calculateFitness(currentSeq, allMutations) });
//     }

//     res.json({
//         finalSequence: currentSeq,
//         mutations: allMutations,
//         fitnessHistory,
//         hotspots: [] // logic remains the same as previous
//     });
// });

// app.listen(PORT, () => console.log(`Scientific Backend running on port ${PORT}`));