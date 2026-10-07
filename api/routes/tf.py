from flask import Blueprint, request, jsonify, session
from models import db, bcrypt, CompanyAuth,UserAuth, TradeFinance, TfDocs, TfDocsPages
from ..utils import generate_id, allowed_file, check_extension, jwt_and_api_key_required, custom_auth_required, get_authenticated_user
from flask_jwt_extended import get_jwt_identity
from ..ai.tf import extract_tf_informations, documents_classification
import os
from collections import defaultdict

from pdf2image import convert_from_path

import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

tf_bp = Blueprint('tf', __name__)

UPLOAD_FOLDER = os.path.join('static','uploads', 'tf')

document_type_to_index = {
    'MT700 SWIFT Message': 0,
    'Bill of Exchange': 1,
    'Bill of Lading': 2,
    'Letter of Credit': 3,
    'Invoice': 4,
    'Delivery Receipt': 5,
    'Certificate of Origin': 6,
    'Purchase Order': 7
}

index_to_document_type = {v: k for k, v in document_type_to_index.items()}

@tf_bp.route('/v1/list', methods=['GET'])
@custom_auth_required
def get_trade_finance_list():
    # Extract token from headers or session
    user = get_authenticated_user()
    if not user:
        return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
    
    if not user or user.role != "analyst":
        return jsonify({"status_code": "FAILED", "message": "Analyst access required"}), 403
    
    # Query the TradeFinance records for the authenticated user
    trade_finance_list = TradeFinance.query.filter_by(userId=user.id).all()
    
    if not trade_finance_list:
        return jsonify({"statusCode": "SUCCESSFUL", "tradeFinanceRecords": []}), 200
    
    # Serialize the list of TradeFinance records
    trade_finance_list_serialized = [
        {
            "id": tf.id,
            "title": tf.title,
            "company": tf.company,
            "menu": tf.menu,
            "totalDocumentTypes": tf.totalDocumentTypes,
            "totalPages": tf.totalPages,
            "manualSupervisor": tf.manualSupervisor,
            "status": tf.status,
            "createdAt": tf.createdAt.strftime('%Y-%m-%d %H:%M:%S'),
            "updatedAt": tf.updatedAt.strftime('%Y-%m-%d %H:%M:%S')
        }
        for tf in trade_finance_list
    ]

    return jsonify({"statusCode": "SUCCESSFUL", "tradeFinanceRecords": trade_finance_list_serialized}), 200

@tf_bp.route('/v1/delete', methods=['DELETE'])
@custom_auth_required
def delete_bs():
    try:
        user = get_authenticated_user()
        if not user:
            return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
        
        if not user or user.role != "analyst":
            return jsonify({"status_code": "FAILED", "message": "Analyst access required"}), 403
        
        tf_id = request.args.get('tfId')
        if not tf_id:
            return jsonify({"statusCode": "FAILED", "message": "Invalid request data"}), 400

        trade_finance_record = TradeFinance.query.filter_by(id=tf_id, userId=user.id).first()
        if not trade_finance_record:
            return jsonify({"statusCode": "FAILED", "message": "Bank statement not found"}), 404

        tf_docs_records = TfDocs.query.filter_by(tfId=tf_id).all()
        
        for tf_doc in tf_docs_records:
            tf_docs_pages_records = TfDocsPages.query.filter_by(tfDocsId=tf_doc.id).all()
            for tf_docs_page in tf_docs_pages_records:
                db.session.delete(tf_docs_page)
        
        for tf_doc in tf_docs_records:
            db.session.delete(tf_doc)
        
        # Delete the TradeFinance record
        db.session.delete(trade_finance_record)
        db.session.commit()

        return jsonify({"statusCode": "SUCCESSFUL", "message": "Bank statement and related data deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"statusCode": "FAILED", "message": str(e)}), 500

@tf_bp.route('/v1/summary', methods=['GET'])
@custom_auth_required
def get_tf_summary():
    user = get_authenticated_user()
    if not user:
        return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
    
    if not user or user.role != "analyst":
        return jsonify({"status_code": "FAILED", "message": "Analyst access required"}), 403
    
    tf_id = request.args.get('tfId')
    if not tf_id:
        return jsonify({"statusCode": "FAILED", "message": "Invalid request data"}), 400
    
    trade_finance_record = TradeFinance.query.filter_by(id=tf_id, userId=user.id).first()
    
    if not trade_finance_record:
        return jsonify({"statusCode": "FAILED", "message": "TradeFinance record not found"}), 404
    
    trade_finance_data = {
        "id": trade_finance_record.id,
        "title": trade_finance_record.title,
        "createdAt": trade_finance_record.createdAt.strftime('%Y-%m-%d %H:%M:%S'),
        "company": trade_finance_record.company,
        "menu": trade_finance_record.menu,
        "manualSupervisor": trade_finance_record.manualSupervisor
    }

    return jsonify({"statusCode": "SUCCESSFUL", "tradeFinanceRecords": trade_finance_data}), 200

@tf_bp.route('/v1/attachments', methods=['GET'])
@custom_auth_required
def get_attachments():
    
    user = get_authenticated_user()
    if not user:
        return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
    
    if not user or user.role != "analyst":
        return jsonify({"status_code": "FAILED", "message": "Analyst access required"}), 403
    
    tf_id = request.args.get('tfId')
    
    if not tf_id:
        return jsonify({"statusCode": "FAILED", "message": "Missing tfId parameter"}), 400

    trade_finance = TradeFinance.query.get(tf_id)
    if not trade_finance:
        return jsonify({"statusCode": "FAILED", "message": "Trade finance record not found"}), 404
    
    tf_docs = TfDocs.query.filter_by(tfId=tf_id).all()
    if not tf_docs:
        return jsonify({"statusCode": "FAILED", "message": "No documents found for this trade finance record"}), 404
    
    attachments = []
    for doc in tf_docs:
        doc_pages = TfDocsPages.query.filter_by(tfDocsId=doc.id).all()
        attachments.append({
            "documentId": doc.id,
            "documentName": doc.name,  
            "documentDescription": doc.description, 
            "documentType": doc.documentType,
            "totalPages": len(doc_pages)  
        })

    return jsonify({"statusCode": "SUCCESSFUL", "attachments": attachments}), 200

@tf_bp.route('/v1/consistency', methods=['GET'])
@custom_auth_required
def get_tf_consistency():
    user = get_authenticated_user()
    if not user:
        return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
    
    if not user or user.role != "analyst":
        return jsonify({"status_code": "FAILED", "message": "Analyst access required"}), 403
    
    tf_id = request.args.get('tfId')
    
    if not tf_id:
        return jsonify({"statusCode": "FAILED", "message": "Missing tfId parameter"}), 400

    trade_finance = TradeFinance.query.get(tf_id)
    if not trade_finance:
        return jsonify({"statusCode": "FAILED", "message": "Trade finance record not found"}), 404
    
    tf_docs = TfDocs.query.filter_by(tfId=tf_id).all()
    if not tf_docs:
        return jsonify({"statusCode": "FAILED", "message": "No documents found for this trade finance record"}), 404
    
    data = [
        {
            'documentId': doc.id,
            'documentType': doc.documentType,
            'documentName': doc.name
        }
        for doc in tf_docs
    ]
    
    if all(doc.main is False for doc in tf_docs):
        return jsonify({"statusCode": "FAILED", "message": "Please choose main document", "data": data}), 200
    
    data = []
    for doc in tf_docs:
        pages = TfDocsPages.query.filter_by(tfDocsId=doc.id).all()
        page_sources = [page.source for page in pages]
        doc_data = {
            'documentId': doc.id,
            'documentType': doc.documentType,
            'main': doc.main,
            'fieldLCNo': doc.fieldLCNo,
            'fieldBeneficiary': doc.fieldBeneficiary,
            'fieldDrawee': doc.fieldDrawee,
            'fieldCustomer': doc.fieldCustomer,
            'fieldCurrency': doc.fieldCurrency,
            'fieldAmount': doc.fieldAmount,
            'fieldTenor': doc.fieldTenor,
            'pages': page_sources
        }
        data.append(doc_data)

    return jsonify({"statusCode": "SUCCESSFUL", "data": data}), 200

@tf_bp.route('/v1/main', methods=['PUT'])
@custom_auth_required
def change_main():
    user = get_authenticated_user()
    if not user:
        return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
    
    if not user or user.role != "analyst":
        return jsonify({"status_code": "FAILED", "message": "Analyst access required"}), 403
    
    doc_id = request.args.get('docId')
    
    if not doc_id:
        return jsonify({"statusCode": "FAILED", "message": "Missing docId parameter"}), 400

    tf_doc = TfDocs.query.filter_by(id=doc_id).all()
    if not tf_doc:
        return jsonify({"statusCode": "FAILED", "message": "No document found for this trade finance record"}), 404
    
    TfDocs.query.filter_by(id=doc_id).update({'main': True})

    db.session.commit()
        

    return jsonify({"statusCode": "SUCCESSFUL", "message": "Main document set successfully."}), 200


@tf_bp.route('/v1/create', methods=['POST'])
@custom_auth_required
def create_tf():
    tf = None
    try:
        id = generate_id()

        user = get_authenticated_user()
        if not user:
            return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
        user_id = user.id
        
        if not user or user.role != "analyst":
            return jsonify({"status_code": "FAILED", "message": "Analyst access required"}), 403
        
        company = CompanyAuth.query.get(user.companyId)
        if not company:
            return jsonify({"statusCode": "FAILED", "message": "Company not found"}), 404
        
        if company.limit is not None:
            if company.usage >= company.limit:
                return jsonify({"statusCode": "FAILED", "message": "Usage limit exceeded"}), 403
            
        title = request.form.get('title', 'Dokumen Trade Finance')
        company_name = request.form.get('company', 'General')
        menu = request.form.get('menu', 'Trade Finance')
        manual_sup_raw = request.form.get('manual_supervisor', '0')
        manual_supervisor = str(manual_sup_raw).lower() in ['true', '1', 't', 'y', 'yes']
        files = request.files.getlist('files')
        SAVE_DIR = os.path.join(UPLOAD_FOLDER, id)
        os.makedirs(SAVE_DIR, exist_ok=True)
        
        init_prompt_usage = 0
        init_completion_usage = 0

        if not files or any(not allowed_file(file.filename) for file in files):
            return jsonify({"statusCode": "FAILED", "message": "Invalid file format"}), 400

        tf = TradeFinance(
            id=id,
            userId=user_id,
            companyId = user.companyId,
            title=title,
            company=company_name,
            menu=menu,
            totalDocumentTypes=0,
            totalPages=0,
            manualSupervisor=manual_supervisor,
            status=0
        )
        db.session.add(tf)
        db.session.commit()

        i = 1
        page_ids = []
        page_paths = []
        document_type_pages = defaultdict(list)
        for file in files:
            if check_extension(file.filename) == "pdf":
                pdf_path = os.path.join(SAVE_DIR, f'{id}_{file.filename}.pdf')
                file.save(pdf_path)
                pages = convert_from_path(pdf_path, 300)
                os.remove(pdf_path)
                for page in pages:
                    page_id = f'{id}_{i}'
                    page_path = os.path.join(SAVE_DIR,f'{page_id}.jpg')
                    page.save(page_path)
                    page_ids.append(page_id)
                    page_paths.append(page_path)
                    i += 1
            else:
                page_id = f'{id}_{i}'
                page_path = os.path.join(SAVE_DIR,f'{page_id}.jpg')
                file.save(page_path)
                page_ids.append(page_id)
                page_paths.append(page_path)
                i += 1

        total_pages = i-1
        company.usage += total_pages
        
        document_type_pages = defaultdict(list)

        for i in range(len(page_ids)):            
            classification_result, prompt_usage, completion_usage = documents_classification(page_paths[i])
            init_prompt_usage = init_prompt_usage + prompt_usage
            init_completion_usage = init_completion_usage + completion_usage
            
            document_type = classification_result.get('documentType')
            tfid_index = document_type_to_index.get(document_type, -1) 
            document_type_pages[tfid_index].append((page_ids[i], page_paths[i]))
                        
        for document_type_id, pages in document_type_pages.items():
            image_paths = [page[1] for page in pages]
            result, prompt_usage, completion_usage = extract_tf_informations(image_paths)
            init_prompt_usage = init_prompt_usage + prompt_usage
            init_completion_usage = init_completion_usage + completion_usage
            
            if result:
                tf_docs = TfDocs(
                    id = f"{id}_{document_type_id}",
                    tfId = id,
                    main=False,
                    documentType = index_to_document_type.get(document_type_id, 'Unknown Document Type'),
                    fieldLCNo = result.get('fieldLCNo'),
                    fieldBeneficiary = result.get('fieldBeneficiary'),
                    fieldDrawee = result.get('fieldDrawee'),
                    fieldCustomer = result.get('fieldCustomer'),
                    fieldCurrency = result.get('fieldCurrency'),
                    fieldAmount = result.get('fieldAmount'),
                    fieldTenor = result.get('fieldTenor')
                )
                db.session.add(tf_docs)
                db.session.commit()
                
            page_counter = 1 
            for page_id, image_path in pages:
                tf_docs_pages = TfDocsPages(
                    id = f"{id}_{document_type_id}_{page_counter}",
                    tfDocsId = f"{id}_{document_type_id}",
                    source = image_path
                )
                page_counter += 1
                db.session.add(tf_docs_pages)
        
        tf.status = "Finished"
        tf.totalPages = total_pages
        tf.totalDocumentTypes = len(document_type_pages)
        tf.promptUsage = init_prompt_usage
        tf.completionUsage = init_completion_usage
        db.session.commit()        

        return jsonify({"statusCode": "SUCCESSFUL", "tfId": tf.id}), 201
    except Exception as e:
        if tf:
            tf.status = "Error"
            db.session.commit()
        logger.error(e)
        return jsonify({"statusCode": "FAILED", "message": str(e) or "INTERNAL SERVER ERROR."}), 500
