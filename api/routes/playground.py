from flask import Blueprint, request, jsonify
from flask_login import login_required
import os, json, tempfile
from pdf2image import convert_from_path
from openai import OpenAI
from dotenv import load_dotenv
from difflib import SequenceMatcher
from api.utils import encode_image, check_extension

load_dotenv()

playground_api_bp = Blueprint('playground_api', __name__)

def get_openai_client():
    api_key = os.getenv('BS_OPENAI_API_KEY') or os.getenv('OPENAI_API_KEY')
    if not api_key:
        return None
    return OpenAI(api_key=api_key)

def process_file_to_base64_images(file_storage):
    """
    Saves file temporarily, converts PDF to image or reads image directly, and returns a list of base64 strings.
    """
    if not file_storage or not file_storage.filename:
        return []
    
    filename = file_storage.filename
    ext = check_extension(filename)
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as temp_file:
        file_storage.save(temp_file.name)
        temp_path = temp_file.name

    base64_images = []
    try:
        if ext == 'pdf':
            pages = convert_from_path(temp_path, dpi=200, first_page=1, last_page=2)
            for page in pages:
                with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as page_file:
                    page.save(page_file.name, 'JPEG')
                    base64_images.append(encode_image(page_file.name))
                    os.remove(page_file.name)
        else:
            base64_images.append(encode_image(temp_path))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    return base64_images

def string_similarity(a, b):
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, str(a).lower().strip(), str(b).lower().strip()).ratio()


@playground_api_bp.route('/v1/doc-to-doc/compare', methods=['POST'])
@playground_api_bp.route('/doc-to-doc/compare', methods=['POST'])
@login_required
def compare_docs():
    """
    Performs AI Document-to-Document Reconciliation using OpenAI Vision API.
    Supports file uploads (file_a, file_b) and/or JSON fallback.
    """
    try:
        client = get_openai_client()
        model_name = os.getenv('OPENAI_VISION_MODEL', 'gpt-4o')

        file_a = request.files.get('file_a')
        file_b = request.files.get('file_b')
        doc_a_name = request.form.get('doc_a_name', 'Document A')
        doc_b_name = request.form.get('doc_b_name', 'Document B')

        doc_a_json_str = request.form.get('doc_a_json') or request.json.get('doc_a_json') if request.is_json else None
        doc_b_json_str = request.form.get('doc_b_json') or request.json.get('doc_b_json') if request.is_json else None

        base64_a = process_file_to_base64_images(file_a) if file_a else []
        base64_b = process_file_to_base64_images(file_b) if file_b else []

        # If real files are uploaded and OpenAI API key is configured, use OpenAI Vision API
        if client and (base64_a or base64_b):
            system_prompt = """
            You are an expert AI Intelligent Document Processing (IDP) Reconciliation Analyst.
            Your task is to compare Document A and Document B, extract their key fields, identify discrepancies, and output a complete reconciliation report in JSON format.

            Output JSON schema:
            {
                "doc_a_type": "Extracted document type A name",
                "doc_b_type": "Extracted document type B name",
                "overall_match_score": 85.5,
                "reconciliation_status": "PASSED" | "WARNING" | "FAILED",
                "ai_summary": "Detailed executive summary explanation of the comparison, discrepancies, and findings.",
                "comparison_matrix": [
                    {
                        "label": "Comparison Field Name (e.g. Reference No, Total Amount, Date, Company Name)",
                        "field_a": "field_key",
                        "value_a": "Extracted value from Doc A",
                        "field_b": "field_key",
                        "value_b": "Extracted value from Doc B",
                        "match_type": "MATCH" | "FUZZY_MATCH" | "MISMATCH",
                        "score": 100.0,
                        "note": "Audit comment explaining why it matched or mismatched"
                    }
                ]
            }
            """

            content = [{"type": "text", "text": f"Document A Type: {doc_a_name}\nDocument B Type: {doc_b_name}\nPlease read the images of Document A and Document B below and perform full reconciliation."}]
            
            for img in base64_a:
                content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img}"}})
            for img in base64_b:
                content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img}"}})

            response = client.chat.completions.create(
                model=model_name,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": content}
                ]
            )

            result = json.loads(response.choices[0].message.content)
            result['status_code'] = 'SUCCESSFUL'
            return jsonify(result)

        # Fallback algorithm if JSON payload or mock test
        doc_a = {}
        doc_b = {}
        if doc_a_json_str:
            try: doc_a = json.loads(doc_a_json_str) if isinstance(doc_a_json_str, str) else doc_a_json_str
            except: pass
        if doc_b_json_str:
            try: doc_b = json.loads(doc_b_json_str) if isinstance(doc_b_json_str, str) else doc_b_json_str
            except: pass

        if not doc_a and request.is_json:
            doc_a = request.json.get('doc_a', {})
            doc_b = request.json.get('doc_b', {})

        field_mappings = [
            {"field_a": "lc_number", "field_b": "lc_reference", "label": "LC Reference No"},
            {"field_a": "beneficiary_name", "field_b": "seller_name", "label": "Beneficiary / Seller"},
            {"field_a": "total_amount", "field_b": "invoice_amount", "label": "Total Amount"},
            {"field_a": "currency", "field_b": "currency", "label": "Currency"},
            {"field_a": "issue_date", "field_b": "invoice_date", "label": "Document Date"}
        ]

        comparison_matrix = []
        total_score = 0.0

        for mapping in field_mappings:
            key_a = mapping.get('field_a')
            key_b = mapping.get('field_b')
            label = mapping.get('label')

            val_a = str(doc_a.get(key_a, '')).strip()
            val_b = str(doc_b.get(key_b, '')).strip()

            if val_a == val_b and val_a != '':
                match_type = "MATCH"
                score = 100.0
                note = "Exact match verified"
            else:
                sim = string_similarity(val_a, val_b)
                score = round(sim * 100.0, 1)
                if score >= 85.0:
                    match_type = "FUZZY_MATCH"
                    note = f"High similarity ({score}%) - Minor variant detected"
                else:
                    match_type = "MISMATCH"
                    note = f"Discrepancy detected: '{val_a}' vs '{val_b}'"

            total_score += score
            comparison_matrix.append({
                "label": label,
                "field_a": key_a,
                "value_a": val_a,
                "field_b": key_b,
                "value_b": val_b,
                "match_type": match_type,
                "score": score,
                "note": note
            })

        avg_score = round(total_score / len(field_mappings), 1) if field_mappings else 0.0
        reconcile_status = "PASSED" if avg_score >= 90.0 else ("WARNING" if avg_score >= 70.0 else "FAILED")

        summary = f"Analisis AI menunjukkan skor rekonsiliasi {avg_score}%. "
        if reconcile_status == "PASSED":
            summary += "Semua data utama antara Dokumen A dan Dokumen B cocok sepenuhnya."
        elif reconcile_status == "WARNING":
            summary += "Terdapat beberapa perbedaan kecil (misal nominal amount atau penulisan nama) yang memerlukan pemeriksaan."
        else:
            summary += "Ditemukan ketidakcocokan signifikan pada data transaksi."

        return jsonify({
            "status_code": "SUCCESSFUL",
            "doc_a_type": doc_a_name,
            "doc_b_type": doc_b_name,
            "overall_match_score": avg_score,
            "reconciliation_status": reconcile_status,
            "ai_summary": summary,
            "comparison_matrix": comparison_matrix
        })

    except Exception as e:
        return jsonify({
            "status_code": "ERROR",
            "message": str(e)
        }), 500
