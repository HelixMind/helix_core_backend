"""
HelixMind — ResFinder Annotation Service
Self-hosted resistance gene detection. No rate limits, <2s latency.

Dependencies:
    pip install resfinder
    git clone https://git.cge.cbs.dtu.dk/public/resfinder_db.git
    git clone https://git.cge.cbs.dtu.dk/public/pointfinder_db.git
    apt-get install kma blast+
"""

import asyncio
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

RESFINDER_DB   = Path(os.getenv("RESFINDER_DB_PATH",   "./databases/resfinder_db"))
POINTFINDER_DB = Path(os.getenv("POINTFINDER_DB_PATH", "./databases/pointfinder_db"))

# Organisms supported by PointFinder (chromosomal point mutations)
POINTFINDER_ORGANISMS = {
    "escherichia coli",
    "klebsiella pneumoniae",
    "salmonella",
    "campylobacter jejuni",
    "campylobacter coli",
    "staphylococcus aureus",
    "enterococcus faecalis",
    "enterococcus faecium",
    "helicobacter pylori",
    "mycobacterium tuberculosis",
    "neisseria gonorrhoeae",
}

CONFIDENCE_THRESHOLDS = {
    "HIGH":   (0.99, 0.90),   # (min_identity, min_coverage)
    "MEDIUM": (0.90, 0.60),
    "LOW":    (0.00, 0.00),
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def analyze_sequence(
    sequence: str,
    organism: Optional[str] = None,
    identity_threshold: float = 0.90,
    min_coverage: float = 0.60,
) -> dict:
    """
    Run ResFinder against a raw DNA sequence string.

    Args:
        sequence:           Raw nucleotide sequence (ATCG + IUPAC ambiguity codes)
        organism:           Optional species name (enables PointFinder point mutations)
        identity_threshold: Min % identity to report a hit (0.0–1.0)
        min_coverage:       Min % gene coverage to report a hit (0.0–1.0)

    Returns:
        {
            hits: list[ResHit],
            resistance_classes: list[str],
            hit_count: int,
            db_version: str,
            pointfinder_enabled: bool,
            analysis_meta: dict
        }
    """
    _validate_sequence(sequence)
    _validate_dbs()

    use_pointfinder = (
        organism is not None
        and organism.lower() in POINTFINDER_ORGANISMS
    )

    with tempfile.TemporaryDirectory() as tmpdir:
        fasta_path = _write_fasta(sequence, Path(tmpdir))
        output_dir = Path(tmpdir) / "output"
        output_dir.mkdir()

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            _run_resfinder_sync,
            str(fasta_path),
            str(output_dir),
            organism or "other",
            identity_threshold,
            min_coverage,
            use_pointfinder,
        )

        return _parse_results(
            output_dir,
            identity_threshold,
            min_coverage,
            use_pointfinder,
        )


async def stream_analyze_sequence(
    sequence: str,
    organism: Optional[str] = None,
    identity_threshold: float = 0.90,
    min_coverage: float = 0.60,
):
    """
    Async generator that yields events as analysis progresses.
    Designed for SSE (Server-Sent Events) streaming endpoint.

    Yields dicts:
        {"status": "running",  "message": str}
        {"status": "hit",      "data": ResHit}
        {"status": "complete", "summary": dict}
        {"status": "error",    "message": str}
    """
    try:
        yield {"status": "running", "message": "ResFinder analysis started"}

        results = await analyze_sequence(
            sequence, organism, identity_threshold, min_coverage
        )

        for hit in results["hits"]:
            yield {"status": "hit", "data": hit}
            await asyncio.sleep(0)  # yield event loop control between hits

        yield {
            "status": "complete",
            "summary": {
                "hit_count":          results["hit_count"],
                "resistance_classes": results["resistance_classes"],
                "db_version":         results["db_version"],
                "pointfinder_enabled": results["pointfinder_enabled"],
                "analysis_meta":      results["analysis_meta"],
            },
        }

    except ResFinderError as e:
        logger.error("ResFinder analysis failed: %s", e)
        yield {"status": "error", "message": str(e)}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _validate_sequence(sequence: str) -> None:
    if len(sequence) < 100:
        raise ResFinderError("Sequence too short — minimum 100 bp required")
    if len(sequence) > 10_000_000:
        raise ResFinderError("Sequence too long — maximum 10 Mbp supported")

    valid_chars = set("ATCGatcgNnRrYySsWwKkMmBbDdHhVv-")
    invalid = set(sequence) - valid_chars
    if invalid:
        raise ResFinderError(f"Invalid characters in sequence: {invalid}")


def _validate_dbs() -> None:
    if not RESFINDER_DB.exists():
        raise ResFinderError(
            f"ResFinder DB not found at {RESFINDER_DB}. "
            "Run: git clone https://git.cge.cbs.dtu.dk/public/resfinder_db.git"
        )
    if not POINTFINDER_DB.exists():
        raise ResFinderError(
            f"PointFinder DB not found at {POINTFINDER_DB}. "
            "Run: git clone https://git.cge.cbs.dtu.dk/public/pointfinder_db.git"
        )


def _write_fasta(sequence: str, directory: Path) -> Path:
    fasta_path = directory / "input.fasta"
    fasta_path.write_text(f">helixmind_query\n{sequence}\n")
    return fasta_path


def _run_resfinder_sync(
    fasta: str,
    outdir: str,
    organism: str,
    threshold: float,
    min_coverage: float,
    use_pointfinder: bool,
) -> None:
    # Import here so the module loads even if resfinder isn't installed yet
    from resfinder.run_resfinder import main as resfinder_main

    args = [
        "-i", fasta,
        "-o", outdir,
        "-s", organism,
        "-db_res", str(RESFINDER_DB),
        "-db_point", str(POINTFINDER_DB),
        "-t", str(threshold),
        "-l", str(min_coverage),
        "--acquired",                      # screen acquired resistance genes
        "--outputPath", outdir,
    ]

    if use_pointfinder:
        args.append("--point")             # chromosomal point mutations

    resfinder_main(args)


def _parse_results(
    output_dir: Path,
    identity_threshold: float,
    min_coverage: float,
    pointfinder_enabled: bool,
) -> dict:
    hits = []

    # --- Acquired resistance genes ---
    results_tab = output_dir / "ResFinder_results_tab.txt"
    if results_tab.exists():
        for line in results_tab.read_text().splitlines()[1:]:
            cols = line.split("\t")
            if len(cols) < 10 or cols[0].strip() == "":
                continue
            try:
                identity = float(cols[4])
                coverage = float(cols[5])
                hit = {
                    "gene":             cols[0].strip(),
                    "accession":        cols[2].strip(),
                    "identity":         round(identity, 4),
                    "coverage":         round(coverage, 4),
                    "resistance_class": cols[9].strip(),
                    "position": {
                        "start": int(cols[6]),
                        "end":   int(cols[7]),
                    },
                    "confidence":       _confidence_tier(identity, coverage),
                    "source":           "acquired",
                }
                hits.append(hit)
            except (ValueError, IndexError) as e:
                logger.warning("Skipping malformed result row: %s — %s", line, e)

    # --- Point mutations (PointFinder) ---
    point_tab = output_dir / "PointFinder_results_tab.txt"
    if pointfinder_enabled and point_tab.exists():
        for line in point_tab.read_text().splitlines()[1:]:
            cols = line.split("\t")
            if len(cols) < 6 or cols[0].strip() in ("", "No hit found"):
                continue
            try:
                hit = {
                    "gene":             cols[0].strip(),
                    "mutation":         cols[1].strip(),   # e.g. "p.S83L"
                    "resistance_class": cols[4].strip(),
                    "phenotype":        cols[5].strip(),
                    "confidence":       "HIGH",             # point mutations are exact
                    "source":           "chromosomal",
                    "identity":         1.0,
                    "coverage":         1.0,
                }
                hits.append(hit)
            except (ValueError, IndexError) as e:
                logger.warning("Skipping malformed PointFinder row: %s — %s", line, e)

    resistance_classes = sorted({h["resistance_class"] for h in hits if h["resistance_class"]})

    return {
        "hits":                 hits,
        "resistance_classes":   resistance_classes,
        "hit_count":            len(hits),
        "db_version":           _get_db_version(),
        "pointfinder_enabled":  pointfinder_enabled,
        "analysis_meta": {
            "identity_threshold": identity_threshold,
            "min_coverage":       min_coverage,
            "note": (
                f"ResFinder DB (acquired resistance genes)"
                f"{' + PointFinder (chromosomal point mutations)' if pointfinder_enabled else ''}. "
                f"Hits reported at ≥{identity_threshold*100:.0f}% identity "
                f"and ≥{min_coverage*100:.0f}% coverage."
            ),
        },
    }


def _confidence_tier(identity: float, coverage: float) -> str:
    if identity >= 0.99 and coverage >= 0.90:
        return "HIGH"
    if identity >= 0.90 and coverage >= 0.60:
        return "MEDIUM"
    return "LOW"


def _get_db_version() -> str:
    changelog = RESFINDER_DB / "CHANGELOG.md"
    if changelog.exists():
        first_line = changelog.read_text().splitlines()[0]
        return first_line.strip("# ").strip()
    return "resfinder_db (version unknown)"


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------

class ResFinderError(Exception):
    pass
