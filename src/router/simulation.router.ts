import { Router } from 'express';
import { checkMutation, parseFastaController, parseGffController, simulateController } from '../controller/simulation.controller.js';
import { uploadFasta } from '../middlewares/upload.middleware.js';

const simRouter = Router();

// Endpoint 1: Convert FASTA text to JSON
simRouter.post("/parse-fasta", uploadFasta.array("fasta-file", 5), parseFastaController);

// Endpoint 2: Convert GFF text to JSON features
simRouter.post("/parse-gff", uploadFasta.array("fasta-file", 5), parseGffController);

// Endpoint 3: Run the heavy lifting simulation
simRouter.post("/simulate", uploadFasta.array("fasta-file", 5), simulateController);

simRouter.post("/check-mutation", uploadFasta.fields([
    {name: "query_fasta_files", maxCount: 1},
    {name: "ref_fasta_files", maxCount: 1}
]), checkMutation);

export default simRouter;