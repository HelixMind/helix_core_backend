"""
HelixMind — Build Co-occurrence Matrix from BV-BRC (PATRIC)
scripts/build_cooccurrence_matrix.py

Pulls AMR metadata from BV-BRC public API, computes real resistance class
pair frequencies from clinical isolates, writes matrix to core/data/.

Run once to generate the matrix. Re-run periodically to update.

Usage:
    python3 scripts/build_cooccurrence_matrix.py
    → writes backend/core/data/cooccurrence_matrix.json

BV-BRC API docs: https://www.bv-brc.org/api/doc/
"""

import asyncio
import json
import logging
import os
from collections import defaultdict
from itertools import combinations
from pathlib import Path

import httpx

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

BV_BRC_API     = "https://www.bv-brc.org/api/genome_amr/"
OUTPUT_DIR     = Path(__file__).parent.parent / "backend" / "core" / "data"
OUTPUT_FILE    = OUTPUT_DIR / "cooccurrence_matrix.json"

# Map BV-BRC antibiotic names → AMR classes
# Source: WHONET/EUCAST antibiotic classification
DRUG_TO_CLASS = {
    # Beta-lactams
    "ampicillin": "beta-lactam", "amoxicillin": "beta-lactam",
    "amoxicillin/clavulanic acid": "beta-lactam", "piperacillin": "beta-lactam",
    "piperacillin/tazobactam": "beta-lactam", "cephalothin": "beta-lactam",
    "cefazolin": "beta-lactam", "cefoxitin": "beta-lactam",
    "ceftriaxone": "beta-lactam", "ceftazidime": "beta-lactam",
    "cefepime": "beta-lactam", "cefotaxime": "beta-lactam",
    "meropenem": "carbapenem", "imipenem": "carbapenem",
    "ertapenem": "carbapenem", "doripenem": "carbapenem",
    # Aminoglycosides
    "gentamicin": "aminoglycoside", "tobramycin": "aminoglycoside",
    "amikacin": "aminoglycoside", "streptomycin": "aminoglycoside",
    "kanamycin": "aminoglycoside", "neomycin": "aminoglycoside",
    # Fluoroquinolones
    "ciprofloxacin": "fluoroquinolone", "levofloxacin": "fluoroquinolone",
    "moxifloxacin": "fluoroquinolone", "norfloxacin": "fluoroquinolone",
    "ofloxacin": "fluoroquinolone", "enrofloxacin": "fluoroquinolone",
    # Tetracyclines
    "tetracycline": "tetracycline", "doxycycline": "tetracycline",
    "minocycline": "tetracycline", "tigecycline": "tetracycline",
    # Sulfonamides / Trimethoprim
    "sulfamethoxazole": "sulfonamide", "sulfisoxazole": "sulfonamide",
    "trimethoprim": "trimethoprim",
    "trimethoprim/sulfamethoxazole": "trimethoprim",
    # Macrolides
    "erythromycin": "macrolide", "azithromycin": "macrolide",
    "clarithromycin": "macrolide", "telithromycin": "macrolide",
    # Colistin / Polymyxins
    "colistin": "colistin", "polymyxin b": "colistin",
    # Glycopeptides
    "vancomycin": "glycopeptide", "teicoplanin": "glycopeptide",
    # Phenicols
    "chloramphenicol": "phenicol", "florfenicol": "phenicol",
    # Rifamycins
    "rifampicin": "rifamycin", "rifampin": "rifamycin",
    # Oxazolidinones
    "linezolid": "oxazolidinone", "tedizolid": "oxazolidinone",
}

# BV-BRC resistant phenotype labels
RESISTANT_LABELS = {"Resistant", "resistant", "R"}


async def fetch_amr_data(limit: int = 25000) -> list[dict]:
    """
    Pull AMR phenotype records from BV-BRC API.
    Each record = one isolate tested against one antibiotic.
    """
    logger.info("Fetching AMR data from BV-BRC (limit=%d)...", limit)

    params = {
        "eq(resistant_phenotype,Resistant)": "",
        "select(genome_id,antibiotic,resistant_phenotype,genome_name)": "",
        "limit": limit,
        "http_accept": "application/json",
    }

    # BV-BRC uses a special query format
    url = (
        f"{BV_BRC_API}"
        f"?eq(resistant_phenotype,Resistant)"
        f"&select(genome_id,antibiotic,resistant_phenotype,genome_name)"
        f"&limit({limit})"
        f"&http_accept=application/json"
    )

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(
            url,
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
        data = response.json()
        logger.info("Fetched %d AMR records", len(data))
        return data


def compute_cooccurrence(records: list[dict]) -> dict:
    """
    Group records by genome_id, collect resistant classes per isolate,
    then compute pair co-occurrence frequencies.
    """
    # Group by genome: genome_id -> set of resistant classes
    genome_classes: dict[str, set] = defaultdict(set)

    for record in records:
        genome_id  = record.get("genome_id", "")
        antibiotic = record.get("antibiotic", "").lower().strip()
        phenotype  = record.get("resistant_phenotype", "")

        if not genome_id or phenotype not in RESISTANT_LABELS:
            continue

        amr_class = DRUG_TO_CLASS.get(antibiotic)
        if amr_class:
            genome_classes[genome_id].add(amr_class)

    logger.info("Grouped into %d genomes with resistance data", len(genome_classes))

    # Count pair co-occurrences
    pair_counts:  dict[str, int] = defaultdict(int)
    class_counts: dict[str, int] = defaultdict(int)
    total_genomes = len(genome_classes)

    for genome_id, classes in genome_classes.items():
        classes = list(classes)
        for cls in classes:
            class_counts[cls] += 1
        for pair in combinations(sorted(classes), 2):
            key = f"{pair[0]}|{pair[1]}"
            pair_counts[key] += 1

    # Convert to prevalence (fraction of all genomes)
    matrix = {}
    for pair_key, count in pair_counts.items():
        cls_a, cls_b = pair_key.split("|")
        prevalence = count / total_genomes if total_genomes > 0 else 0.0
        matrix[pair_key] = {
            "class_a":      cls_a,
            "class_b":      cls_b,
            "count":        count,
            "prevalence":   round(prevalence, 6),
            "total_genomes": total_genomes,
        }

    logger.info("Computed %d unique resistance class pairs", len(matrix))
    return matrix


def write_matrix(matrix: dict, class_counts: dict = None) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    output = {
        "metadata": {
            "source":      "BV-BRC (PATRIC) AMR phenotype database",
            "source_url":  "https://www.bv-brc.org/api/genome_amr/",
            "description": "Real co-occurrence frequencies from clinical isolates",
            "note":        "prevalence = fraction of resistant genomes carrying both classes",
        },
        "matrix": matrix,
    }

    OUTPUT_FILE.write_text(json.dumps(output, indent=2))
    logger.info("Matrix written to %s", OUTPUT_FILE)

    # Print summary
    rare   = sum(1 for v in matrix.values() if v["prevalence"] < 0.05)
    common = sum(1 for v in matrix.values() if v["prevalence"] >= 0.20)
    logger.info("Summary: %d pairs total | %d rare (<5%%) | %d common (>=20%%)",
                len(matrix), rare, common)


async def main():
    try:
        records = await fetch_amr_data(limit=25000)
        matrix  = compute_cooccurrence(records)
        write_matrix(matrix)
        print(f"\n✅ Co-occurrence matrix built from {len(records)} BV-BRC records")
        print(f"   Output: {OUTPUT_FILE}")
        print(f"   Pairs computed: {len(matrix)}")
    except httpx.HTTPStatusError as e:
        logger.error("BV-BRC API error: %s", e)
        print("\n❌ Failed to fetch BV-BRC data — check network and try again")
    except Exception as e:
        logger.exception("Unexpected error: %s", e)


if __name__ == "__main__":
    asyncio.run(main())