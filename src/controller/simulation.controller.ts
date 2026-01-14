import { Request, response, Response } from "express";
import { parseFASTA, parseGFF } from "../utils/bioParsers.js";
import {
  detectMutations,
  parseFASTAService,
  runMutationSimulation,
} from "../services/simulation.service.js";
import { ResponseSchema } from "../types/index.js";

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
    let files = req.files as {
      fasta_files: Express.Multer.File[];
      gff_files: Express.Multer.File[];
    };

    if (!files || !files.fasta_files || files.fasta_files.length <= 0) {
      res.status(400).json({
        status: "error",
        error: "No fasta file uploaded",
      } as ResponseSchema);

      return;
    }

    const fasta_outputs: {
      sequences: Record<string, string>;
      count: number;
    }[] = [];

    files.fasta_files.forEach((fasta_file) => {
      const fasta = fasta_file.buffer.toString("utf-8");

      const records = parseFASTA(fasta);

      fasta_outputs.push({
        sequences: records,
        count: Object.keys(records).length,
      });
    });

    if (!files || !files.gff_files || files.gff_files.length <= 0) {
      res.status(400).json({
        status: "error",
        error: "No gff file uploaded",
      } as ResponseSchema);

      return;
    }

    const gff_outputs: {
      features: ({
        seqname: string;
        type: string;
        name: string;
        start: number;
        end: number;
        strand: number;
      } | null)[];
      count: number;
    }[] = [];

    files.gff_files.forEach((gff_file) => {
      const fasta = gff_file.buffer.toString("utf-8");

      const features = parseGFF(fasta);

      gff_outputs.push({
        features,
        count: features.length,
      });
    });

    const seed = Math.floor(Math.random() * 1000);

    const result = runMutationSimulation({
      ...req.body,
      sequence: fasta_outputs[0].sequences,
      annotatios: gff_outputs[0].features,
      seed,
    });
    res.status(200).json(result);
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
