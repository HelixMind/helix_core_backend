import multer from 'multer';
import path from 'path';

// Define the allowed extensions for HelixAI
const ALLOWED_EXTENSIONS_FASTA = [
  '.fasta', '.fa', '.fna', '.faa',
];

const ALLOWED_EXTENSIONS_GFF = [
  '.gff', '.gff3', '.gtf'
]

// const ALLOWED_EXTENSIONS_FASTA = [
//   '.fastq', '.vcf', '.gbk'
// ]

const storageFastas = multer.diskStorage({
  destination: "../uploads/fastas",
  filename: (req, file, cb) => {
    const suffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    // path.extname extracts the extension (e.g., '.fasta')
    const ext = path.extname(file.originalname); 
    cb(null, file.fieldname + '_' + suffix + ext);
  }
});

const storageGffs = multer.diskStorage({
  destination: "../uploads/gffs"
}); // We use memoryStorage for direct parsing

export const uploadFasta = multer({
  storage: storageFastas,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limit to 10MB for safety
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (ALLOWED_EXTENSIONS_FASTA.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Helix accepts for fasta files only .fasta, .fa, .fna, .faa`));
    }
  }
});

export const uploadGff = multer({
    storage: storageGffs,
    limits: {
        fileSize: 10 * 1024 * 1024, // Limit to 10MB for safety
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
    
        if (ALLOWED_EXTENSIONS_GFF.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${ext}. Helix accepts for gff files only .gff, .gff3, .gtf`));
        }
    }
})