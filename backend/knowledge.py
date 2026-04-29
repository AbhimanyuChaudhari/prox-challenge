import fitz  # PyMuPDF
import json
import os
import base64
import numpy as np
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pickle

FILES_DIR = Path(__file__).parent.parent / "files"
DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

CHUNKS_FILE = DATA_DIR / "chunks.json"
IMAGES_DIR = DATA_DIR / "images"
INDEX_FILE = DATA_DIR / "index.pkl"


def extract_pdf(pdf_path: Path, source_name: str) -> list[dict]:
    doc = fitz.open(str(pdf_path))
    chunks = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text().strip()

        if text and len(text) > 50:
            chunks.append({
                "id": f"{source_name}_p{page_num + 1}",
                "source": source_name,
                "page": page_num + 1,
                "text": text,
                "type": "text"
            })

    doc.close()
    return chunks


def extract_images(pdf_path: Path, source_name: str) -> list[dict]:
    IMAGES_DIR.mkdir(exist_ok=True)
    doc = fitz.open(str(pdf_path))
    image_chunks = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        image_list = page.get_images(full=True)

        for img_idx, img in enumerate(image_list):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            ext = base_image["ext"]

            # skip tiny images (icons, bullets)
            if len(image_bytes) < 5000:
                continue

            img_id = f"{source_name}_p{page_num + 1}_img{img_idx}"
            img_path = IMAGES_DIR / f"{img_id}.{ext}"

            with open(img_path, "wb") as f:
                f.write(image_bytes)

            b64 = base64.b64encode(image_bytes).decode("utf-8")

            image_chunks.append({
                "id": img_id,
                "source": source_name,
                "page": page_num + 1,
                "image_path": str(img_path),
                "image_b64": b64,
                "ext": ext,
                "type": "image"
            })

    doc.close()
    return image_chunks


def build_knowledge_base():
    print("Building knowledge base...")
    all_chunks = []

    pdfs = {
        "owner_manual": FILES_DIR / "owner-manual.pdf",
        "quick_start": FILES_DIR / "quick-start-guide.pdf",
        "selection_chart": FILES_DIR / "selection-chart.pdf",
    }

    for name, path in pdfs.items():
        if not path.exists():
            print(f"Warning: {path} not found, skipping.")
            continue
        print(f"Processing {name}...")
        text_chunks = extract_pdf(path, name)
        image_chunks = extract_images(path, name)
        print(f"  {len(text_chunks)} text chunks, {len(image_chunks)} images")
        all_chunks.extend(text_chunks)
        all_chunks.extend(image_chunks)

    # save chunks (without b64 in main file to keep it small)
    chunks_for_storage = []
    for c in all_chunks:
        stored = {k: v for k, v in c.items() if k != "image_b64"}
        chunks_for_storage.append(stored)

    with open(CHUNKS_FILE, "w") as f:
        json.dump(chunks_for_storage, f, indent=2)

    # build TF-IDF index on text chunks only
    text_chunks = [c for c in all_chunks if c["type"] == "text"]
    texts = [c["text"] for c in text_chunks]
    vectorizer = TfidfVectorizer(stop_words="english", max_features=10000)
    tfidf_matrix = vectorizer.fit_transform(texts)

    with open(INDEX_FILE, "wb") as f:
        pickle.dump({
            "vectorizer": vectorizer,
            "matrix": tfidf_matrix,
            "chunks": text_chunks
        }, f)

    print(f"Done. {len(all_chunks)} total chunks indexed.")
    return all_chunks


def search(query: str, top_k: int = 6) -> list[dict]:
    if not INDEX_FILE.exists():
        build_knowledge_base()

    with open(INDEX_FILE, "rb") as f:
        index = pickle.load(f)

    vectorizer = index["vectorizer"]
    matrix = index["matrix"]
    chunks = index["chunks"]

    query_vec = vectorizer.transform([query])
    scores = cosine_similarity(query_vec, matrix).flatten()
    top_indices = np.argsort(scores)[::-1][:top_k]

    results = []
    for i in top_indices:
        if scores[i] > 0.01:
            chunk = chunks[i].copy()
            chunk["score"] = float(scores[i])
            results.append(chunk)

    return results


def get_images_for_pages(source: str, pages: list[int]) -> list[dict]:
    if not CHUNKS_FILE.exists():
        build_knowledge_base()

    with open(CHUNKS_FILE, "r") as f:
        chunks = json.load(f)

    result = []
    for c in chunks:
        if c["type"] == "image" and c["source"] == source and c["page"] in pages:
            # reload b64 from disk
            img_path = Path(c["image_path"])
            if img_path.exists():
                with open(img_path, "rb") as f:
                    c["image_b64"] = base64.b64encode(f.read()).decode("utf-8")
            result.append(c)
    return result


def get_all_images() -> list[dict]:
    if not CHUNKS_FILE.exists():
        build_knowledge_base()

    with open(CHUNKS_FILE, "r") as f:
        chunks = json.load(f)

    result = []
    for c in chunks:
        if c["type"] == "image":
            img_path = Path(c["image_path"])
            if img_path.exists():
                with open(img_path, "rb") as f:
                    c["image_b64"] = base64.b64encode(f.read()).decode("utf-8")
                result.append(c)
    return result


if __name__ == "__main__":
    build_knowledge_base()