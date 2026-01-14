import { parseFASTA } from "../utils/bioParsers.js";
import { createRNG } from "../utils/rng.js";

// Helper: Classify if a mutation hits a Gene (CDS), Promoter, etc.
const classifyMutation = (position: number, annotations: any[]) => {
    // Requirements #1 & #2: Backend auto-detects coding regions
    const match = annotations.find(f => position >= f.start - 1 && position < f.end);
    return match 
        ? { feature: match.name, type: match.type, isCoding: match.type === "CDS" || match.type === "gene" }
        : { feature: "intergenic", type: "intergenic", isCoding: false };
};

export const detectMutations = (querySeq: string, refSeq: string) => {
    const mutations = [];
    // To Do
    // Basic alignment logic: Compare position by position
    // In a real scenario, use a library like 'bioseq' for Smith-Waterman alignment
    for (let i = 0; i < Math.max(querySeq.length, refSeq.length); i++) {
        if (querySeq[i] !== refSeq[i]) {
            mutations.push({
                pos: i + 1,
                ref: refSeq[i] || '-',
                alt: querySeq[i] || '-',
                type: !refSeq[i] ? 'insertion' : (!querySeq[i] ? 'deletion' : 'substitution')
            });
        }
    }
    return mutations;
};

export const runMutationSimulation = (params: any) => {
    const { sequence, seed, numGenerations, mutationRates, annotations = [] } = params;
    
    // Requirement #4: Input Validation Warnings
    const warnings: string[] = [];
    if (!sequence || sequence.length === 0) throw new Error("Empty sequence provided.");
    if (sequence.length < 200) warnings.push("Extremely short sequence (<200bp); simulation may be unstable.");
    const nRatio = (sequence.match(/N/g) || []).length / sequence.length;
    if (nRatio > 0.1) warnings.push("High 'N' count detected; results may be scientifically inaccurate.");

    const rng = createRNG(seed);
    const nucleotides = ['A', 'T', 'G', 'C'];
    
    const referenceSeq = sequence; // Fixed reference for comparison logic
    let workingSeq = sequence;
    const allMutations = [];
    const genStats = [];

    const { substitutionRate: sub, insertionRate: ins, deletionRate: del } = mutationRates;
    const totalRate = sub + ins + del;

    for (let gen = 0; gen < numGenerations; gen++) {
        let seqArray = workingSeq.split('');
        const mutationPositions = new Set<number>();
        // Poisson-like distribution for mutation counts per generation
        const expectedCount = Math.floor(seqArray.length * totalRate);

        for (let i = 0; i < expectedCount; i++) {
            mutationPositions.add(Math.floor(rng() * seqArray.length));
        }

        const sortedPos = Array.from(mutationPositions).sort((a, b) => a - b);
        let offset = 0;
        let genMutationCount = 0;

        for (const basePos of sortedPos) {
            let pos = basePos + offset;
            if (pos < 0 || pos >= seqArray.length) continue;

            const r = rng();
            const normalized = totalRate > 0 ? r / totalRate : 0;
            
            let type: 'substitution' | 'insertion' | 'deletion' = 'substitution';
            if (normalized > (sub / totalRate)) {
                type = normalized > (sub + ins) / totalRate ? 'deletion' : 'insertion';
            }

            const classification = classifyMutation(basePos, annotations);

            if (classification.type === 'substitution') {
                const originalBase = seqArray[pos];
                const others = nucleotides.filter(n => n !== originalBase);
                seqArray[pos] = others[Math.floor(rng() * 3)];
                
                // Track Mutation vs Reference (Requirement #1)
                allMutations.push({
                    generation: gen + 1,
                    position: basePos + 1,
                    change: `${originalBase}→${seqArray[pos]}`,
                    ...classification
                });
            } 
            else if (classification.type === 'insertion') {
                const newBase = nucleotides[Math.floor(rng() * 4)];
                seqArray.splice(pos, 0, newBase);
                offset++;
                allMutations.push({
                    generation: gen + 1,
                    position: basePos + 1,
                    change: `+${newBase}`,
                    ...classification
                });
            } 
            else if (classification.type === 'deletion') {
                const deletedBase = seqArray[pos];
                seqArray.splice(pos, 1);
                offset--;
                allMutations.push({
                    generation: gen + 1,
                    position: basePos + 1,
                    change: `-${deletedBase}`,
                    ...classification
                });
            }
            genMutationCount++;
        }

        workingSeq = seqArray.join('');

        // Requirement #5: Export Stats (JSON)
        genStats.push({
            generation: gen + 1,
            populationSize: workingSeq.length,
            mutationCount: genMutationCount,
            codingDensity: annotations.length > 0 ? (allMutations.filter(m => m.isCoding).length / (allMutations.length || 1)) : 0
        });
    }

    return { 
        referenceSeq: referenceSeq.substring(0, 100) + "...", 
        currentSeq: workingSeq, 
        mutationLog: allMutations,
        stats: genStats,
        warnings,
        summary: {
            totalMutations: allMutations.length,
            finalLength: workingSeq.length,
            avgMutationsPerGen: (allMutations.length / numGenerations).toFixed(2)
        }
    };
};

export function parseFASTAService(fasta_files: Express.Multer.File[]) {
    if (!fasta_files || fasta_files.length <= 0) {
        throw new Error("Custom Error: No fasta passed")
    }

    const fasta_outputs: {
        sequences: Record<string, string>;
        count: number;
    }[] = [];

    fasta_files.forEach((fasta_file) => {
        const fasta = fasta_file.buffer.toString("utf-8");

        const records = parseFASTA(fasta);

        fasta_outputs.push({
        sequences: records,
        count: Object.keys(records).length,
        });
    });

    return fasta_outputs;
}