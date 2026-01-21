import { Request, Response } from "express";
import {
  detectMutations,
  parseFASTAService,
} from "../services/simulation.service.js";
import { ResponseSchema } from "../types/index.js";
import { calculateFitness, CODON_MAP, getMutatedBase, SeededRandom } from "../services/simulation.service.js";

// 1. FASTA Parser Controller
export const parseFastaController = async (req: Request, res: Response) => {
  let fasta_files = req.files as Express.Multer.File[];

  const fasta_outputs = parseFASTAService(fasta_files);

  res.status(200).json({
    status: "success",
    payload: {
      response: fasta_outputs,
    },
  } as ResponseSchema);
};

// 2. GFF Parser Controller
export const parseGffController = async (req: Request, res: Response) => {
  console.log(req.files, req.file);
  // const { content } = req.body;
  // if (!content) return res.status(400).json({ error: "No GFF content provided" });

  // const features = parseGFF(content);
  // res.json({
  //     features,
  //     count: features.length
  // });

  res.status(200).json({
    respponse: "Testing",
  });
};

// 3. Simulation Engine Controller
export const simulateController = async (req: Request, res: Response) => {
  try {
    let fasta_files = req.files as Express.Multer.File[];

    const fasta_outputs = parseFASTAService(fasta_files);

    const sequence = Object.values(fasta_outputs[0].sequences)[0];
     
    // console.log(sequence);
    
    let { params } = req.body;
    params = JSON.parse(params);
    
    const rng = new SeededRandom(params.seed || Date.now());

    // 3. ENVIRONMENTAL LINKAGE: Temperature affects mutation rate (Arrhenius-like scaling)
    const tempCelsius =
      params.tempUnit === "F"
        ? ((params.temperature - 32) * 5) / 9
        : params.temperature;
    const tempFactor = Math.pow(1.1, (tempCelsius - 37) / 5);
    const effectiveSubRate = params.substitutionRate * tempFactor;

    let currentSeq = sequence;
    const allMutations: {
      generation: number;
      position: number;
      type: "insertion" | "deletion" | "substitution";
      original: any;
      mutated: string;
      aminoAcidChange: string;
      context: "coding" | "non-coding";
    }[] = [];
    const fitnessHistory = [];

    for (let gen = 1; gen <= params.numGenerations; gen++) {
      console.log("In here");
      const seqArray = currentSeq.split("");

      for (let i = 0; i < currentSeq.length; i++) {
        if (rng.next() < effectiveSubRate) {
          const originalBase = seqArray[i];
          const newBase = getMutatedBase(originalBase, rng);

          // Determine Amino Acid Change
          let aaChange = "none";
          const codonStart = Math.floor(i / 3) * 3;
          const originalCodon: string = currentSeq.substr(codonStart, 3);
          if (originalCodon.length === 3) {
            const tempCodon = originalCodon.split("");
            tempCodon[i % 3] = newBase;
            const newCodon: string = tempCodon.join("");
            if (CODON_MAP[originalCodon] !== CODON_MAP[newCodon]) {
              aaChange = `${CODON_MAP[originalCodon]}->${CODON_MAP[newCodon]}`;
            }
          }

          seqArray[i] = newBase;
          allMutations.push({
            generation: gen,
            position: i,
            type: "substitution",
            original: originalBase,
            mutated: newBase,
            aminoAcidChange: aaChange,
            context: i < currentSeq.length - 100 ? "coding" : "non-coding",
          });
        }
      }
      currentSeq = seqArray.join("");
      fitnessHistory.push({
        generation: gen,
        fitness: calculateFitness(currentSeq, allMutations),
      });
    }

    console.log({
      finalSequence: currentSeq,
      mutations: allMutations,
      fitnessHistory,
      hotspots: [], // logic remains the same as previous
    });

    res.json({
      status: "success",
      payload: {
        finalSequence: currentSeq,
        mutations: allMutations,
        fitnessHistory,
        hotspots: [], // logic remains the same as previous
      }
    } as ResponseSchema);
  } catch (error: any) {
    res.status(500).json({ error: `Simulation failed: ${error.message}` });
  }
};

export const checkMutation = async (req: Request, res: Response) => {
  const files = req.files as
    | {
        ref_fasta_files: Express.Multer.File[];
        query_fasta_files: Express.Multer.File[];
      }
    | undefined;

  const ref_fasta_files = files!.ref_fasta_files;
  const query_fasta_files = files!.query_fasta_files;

  if (
    !ref_fasta_files ||
    ref_fasta_files.length <= 0 ||
    !query_fasta_files ||
    query_fasta_files.length <= 0
  ) {
    res.status(400).json({
      status: "error",
      error:
        "Missing required fasta file inputs: please provide both reference and query files.",
    } as ResponseSchema);
    return;
  }

  const { seq_id } = req.body;

  if (!seq_id) {
    return res.status(400).json({
      status: "error",
      error:
        "Please provide the sequence ID (header) you wish to analyze from the query file.",
    });
  }

  const ref_seq = Object.values(
    parseFASTAService(ref_fasta_files)[0].sequences
  )[0];

  if (!ref_seq) {
    res.status(422).json({
      status: "error",
      error:
        "Invalid input, no sequence could be read from the reference fasta file",
    } as ResponseSchema);
    return;
  }

  const query_seq = parseFASTAService(query_fasta_files)[0].sequences[seq_id];

  if (!query_seq) {
    res.status(422).json({
      status: "error",
      error:
        "Invalid input, no sequence could be found for the desired sequece id in the query fasta file passed",
    } as ResponseSchema);
    return;
  }

  console.log("Query Seq:", ref_seq, "Ref Seq:", query_seq);

  const response = detectMutations(query_seq, ref_seq);

  console.log(response);

  res.status(200).json({
    status: "success",
    payload: response,
  } as ResponseSchema);
};