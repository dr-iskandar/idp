from flask import Blueprint, request, jsonify, session
from models import db, bcrypt, CompanyAuth, UserAuth, FaasFs, FaasFsDocs, FaasFsDocsPages, FaasFsDocsBs, FaasFsDocsCs, FaasFsDocsIs
from ..utils import generate_id, allowed_file, check_extension, jwt_and_api_key_required, custom_auth_required, get_authenticated_user, try_decrypt,encrypt
from flask_jwt_extended import get_jwt_identity
from ..ai.fs import classification_inference, fs_inference
import os

from werkzeug.utils import secure_filename
from pdf2image import convert_from_path
from collections import defaultdict

import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

fs_bp = Blueprint('fs', __name__)

UPLOAD_FOLDER = os.path.join('static','uploads', 'faas', 'fs')

@fs_bp.route('/v1/list', methods=['GET'])
@custom_auth_required
def get_fs_list():
    try:
        user = get_authenticated_user()
        if not user:
            return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
        
        if not user or user.role != "analyst":
            return jsonify({"status_code": "FAILED", "message": "Analyst access required"}), 403
        
        fs_list = FaasFs.query.filter_by(userId=user.id).all()

        if not fs_list:
            return jsonify({"statusCode": "SUCCESSFUL", "financialStatements": []}), 200
        fs_list_serialized = [
            {
                "id": fs.id,
                "title": try_decrypt(fs.title),
                "totalPages": fs.totalPages,
                "status": fs.status,
                "createdAt": fs.createdAt.strftime('%Y-%m-%d %H:%M:%S'),
                "updatedAt": fs.updatedAt.strftime('%Y-%m-%d %H:%M:%S')
            }
            for fs in fs_list
        ]

        return jsonify({"statusCode": "SUCCESSFUL", "financialStatements": fs_list_serialized}), 200
    except Exception as e:
        logger.error(e)
        return jsonify({"statusCode": "FAILED", "message": "INTERNAL SERVER ERROR."}), 500
    


@fs_bp.route('/v1/create', methods=['POST'])
@custom_auth_required
def create_fs():
    try:

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
            
        id = generate_id()

        title = request.form['title']
        files = request.files.getlist('files')
        SAVE_DIR = os.path.join(UPLOAD_FOLDER, id)
        os.makedirs(SAVE_DIR, exist_ok=True)

        if not files or any(not allowed_file(file.filename) for file in files):
            return jsonify({"statusCode": "FAILED", "message": "Invalid file format"}), 400

        faas_fs = FaasFs(
            id=id,
            companyId=company.id,
            userId=user_id,
            title=title,
            totalPages=0,
            status=0,
            promptUsage=0,
            completionUsage=0
        
        )
        db.session.add(faas_fs)
        db.session.commit()

        i = 1
        page_ids = []
        page_paths = []
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
                
        company.usage += len(page_paths)

        if company.limit is not None and company.usage > company.limit:
            db.session.rollback()
            return jsonify({"statusCode": "FAILED", "message": "Usage limit exceeded"}), 403


        document_types, prompt_tokens, completion_tokens = classification_inference(page_paths)

        logger.info(f"Document Types for ID {id} : \n {document_types}")

        for doc_type, file_paths in document_types.items():
            faas_fs_docs = FaasFsDocs(
                id=generate_id(),
                fsId=id,
                documentType=doc_type,
            )
            db.session.add(faas_fs_docs)
            db.session.commit()

            for file_path in file_paths:
                page_id = next((pid for pid, path in zip(page_ids, page_paths) if path == file_path), None)
                if page_id:
                    faas_fs_docs_pages = FaasFsDocsPages(
                        id=page_id,
                        fsDocsId=faas_fs_docs.id,
                        source=file_path,
                    )
                    db.session.add(faas_fs_docs_pages)

        fs_data, total_prompt_tokens, total_completion_tokens = fs_inference(document_types, prompt_tokens, completion_tokens)
        logger.info(f"FS Data for ID {id} : \n {fs_data}")
        
        faas_fs.companyName = encrypt(fs_data.get('Balance Sheet', {}).get('company_name'))
        faas_fs.promptUsage = total_prompt_tokens
        faas_fs.completionUsage = total_completion_tokens
        db.session.commit()

        for doc_type, data in fs_data.items():
            faas_fs_docs = FaasFsDocs.query.filter_by(fsId=id, documentType=doc_type).first()
            if faas_fs_docs:
                faas_fs_docs.lastYear = data.get('last_year_period')
                faas_fs_docs.currentYear = data.get('current_year_period')
                db.session.commit()

                if doc_type == 'Balance Sheet':
                    for period in ['last_year', 'current_year']:
                        items = data.get('data')
                        last_year = data['last_year_period'][:4]
                        current_year = data['current_year_period'][:4]
                        faas_fs_docs_bs = FaasFsDocsBs(
                            id=generate_id(),
                            fsDocsId=faas_fs_docs.id,
                            year=last_year if period == 'last_year' else current_year,
                            totalCurrentAssets=next((list(item.values())[0][period] for item in items if 'total_current_assets' in item), None),
                            totalNonCurrentAssets=next((list(item.values())[0][period] for item in items if 'total_non_current_assets' in item), None),
                            totalAssets=next((list(item.values())[0][period] for item in items if 'total_assets' in item), None),
                            totalCurrentLiabilities=next((list(item.values())[0][period] for item in items if 'total_current_liabilities' in item), None),
                            totalNonCurrentLiabilities=next((list(item.values())[0][period] for item in items if 'total_non_current_liabilities' in item), None),
                            totalLiabilities=next((list(item.values())[0][period] for item in items if 'total_liabilities' in item), None),
                            totalEquity=next((list(item.values())[0][period] for item in items if 'total_equity' in item), None)
                        )
                        db.session.add(faas_fs_docs_bs)

                elif doc_type == 'Income Statement':
                    for period in ['last_year', 'current_year']:
                        items = data.get('data')
                        last_year = data['last_year_period'][:4]
                        current_year = data['current_year_period'][:4]
                        faas_fs_docs_is = FaasFsDocsIs(
                            id=generate_id(),
                            fsDocsId=faas_fs_docs.id,
                            year=last_year if period == 'last_year' else current_year,
                            revenue=next((list(item.values())[0][period] for item in items if 'revenue' in item), None),
                            costOfGoods=next((list(item.values())[0][period] for item in items if 'cost_of_goods' in item),
                                next((list(item.values())[0][period] for item in items if any('cost' in key.lower() for key in item.keys())), None)),
                            grossProfit=next((list(item.values())[0][period] for item in items if 'gross_profit' in item), None),
                            earningsBeforeTax=next((list(item.values())[0][period] for item in items if 'earnings_before_tax' in item),
                                next((list(item.values())[0][period] for item in items if any('earning' in key.lower() for key in item.keys())), None))
                        )
                        db.session.add(faas_fs_docs_is)

                elif doc_type == 'Cash Flow Statement':
                    for period in ['last_year', 'current_year']:
                        items = data.get('data')
                        last_year = data['last_year_period'][:4]
                        current_year = data['current_year_period'][:4]
                        faas_fs_docs_cs = FaasFsDocsCs(
                            id=generate_id(),
                            fsDocsId=faas_fs_docs.id,
                            year=last_year if period == 'last_year' else current_year,
                            netCashFromOperatingActivities=next((list(item.values())[0][period] for item in items if 'net_cash_from_operating_activities' in item),
                                next((list(item.values())[0][period] for item in items if any('operating' in key for key in item.keys())), None)),
                            netCashUsedInInvestingActivities=next((list(item.values())[0][period] for item in items if 'net_cash_from_investing_activities' in item),
                                next((list(item.values())[0][period] for item in items if any('investing' in key for key in item.keys())), None)),
                            netCashUsedInFinancingActivities=next((list(item.values())[0][period] for item in items if 'net_cash_from_financing_activities' in item),
                                next((list(item.values())[0][period] for item in items if any('financing' in key for key in item.keys())), None))
                        )
                        db.session.add(faas_fs_docs_cs)
        faas_fs.status = "Finished"
        faas_fs.totalPages = len(page_paths)
        db.session.commit()

        return jsonify({"statusCode": "SUCCESSFUL", "message": "FS created successfully", "id": id}), 201
    except Exception as e:
        faas_fs.status = "Error"
        db.session.commit()
        logger.error(e)
        return jsonify({"statusCode": "FAILED", "message": "INTERNAL SERVER ERROR."}), 500
    

@fs_bp.route('/v1/pages/details', methods=['GET'])
@custom_auth_required
def get_pages_details():
    try:
        user = get_authenticated_user()
        if not user:
            return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
        
        if not user or user.role != "analyst":
            return jsonify({"status_code": "FAILED", "message": "Analyst access required"}), 403
        
        
        fs_id = request.args.get('fsId')
        if not fs_id:
            return jsonify({"statusCode": "FAILED", "message": "Invalid request data"}), 400
        
        faas_fs = FaasFs.query.filter_by(id=fs_id, userId=user.id).first()
        if not faas_fs:
            return jsonify({"statusCode": "FAILED", "message": "Financial statement not found"}), 404
        
        faas_fs_docs = FaasFsDocs.query.filter_by(fsId=fs_id).all()

        pages = []
        for doc in faas_fs_docs:
            doc_pages = FaasFsDocsPages.query.filter_by(fsDocsId=doc.id).all()
            if doc.documentType == "Income Statement":
                financial_data = FaasFsDocsIs.query.filter_by(fsDocsId=doc.id).all()
                fields = ["revenue", "costOfGoods", "grossProfit", "earningsBeforeTax"]
            elif doc.documentType == "Balance Sheet":
                financial_data = FaasFsDocsBs.query.filter_by(fsDocsId=doc.id).all()
                fields = ["totalCurrentAssets", "totalNonCurrentAssets", "totalAssets", 
                          "totalCurrentLiabilities", "totalNonCurrentLiabilities"]
            elif doc.documentType == "Cash Flow Statement":
                financial_data = FaasFsDocsCs.query.filter_by(fsDocsId=doc.id).all()
                fields = ["netCashFromOperatingActivities", "netCashUsedInInvestingActivities", 
                          "netCashUsedInFinancingActivities"]
            else:
                continue 
            
            years = [doc.lastYear, doc.currentYear]
            structured_data = []
            for field in fields:
                row = {"field": field}
                for data in financial_data:
                    row[data.year] = getattr(data, field)
                structured_data.append(row)
            
            page_data = {
                "id": doc.id,
                "documentType": doc.documentType,
                "source": [page.source for page in doc_pages],
                "companyName": try_decrypt(faas_fs.companyName),
                "fields": fields,
                "years": years,
                "data": structured_data
            }
            pages.append(page_data)
        
        return jsonify({
            "statusCode": "SUCCESSFUL",
            "pages": pages
        })
        
        
    except Exception as e:
        logger.error(e)
        return jsonify({"statusCode": "FAILED", "message": "INTERNAL SERVER ERROR."}), 500
    
    
@fs_bp.route('/v1/delete', methods=['DELETE'])
@custom_auth_required
def delete_faas_fs():
    user = get_authenticated_user()
    if not user:
        return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
    
    if not user or user.role != "analyst":
        return jsonify({"status_code": "FAILED", "message": "Analyst access required"}), 403
    
    fs_id = request.args.get('fsId')
    if not fs_id:
        return jsonify({"statusCode": "FAILED", "message": "Invalid request data"}), 400

    faas_fs = FaasFs.query.filter_by(id=fs_id, userId=user.id).first()
    if not faas_fs:
        return jsonify({"statusCode": "FAILED", "message": "Financial statement not found"}), 404

    try:
        faas_fs_docs = FaasFsDocs.query.filter_by(fsId=fs_id).all()
        for doc in faas_fs_docs:
            FaasFsDocsPages.query.filter_by(fsDocsId=doc.id).delete()
            FaasFsDocsBs.query.filter_by(fsDocsId=doc.id).delete()
            FaasFsDocsIs.query.filter_by(fsDocsId=doc.id).delete()
            FaasFsDocsCs.query.filter_by(fsDocsId=doc.id).delete()
            db.session.delete(doc)
        FaasFsDocs.query.filter_by(fsId=fs_id).delete()
        db.session.delete(faas_fs)
        db.session.commit()

        return jsonify({"statusCode": "SUCCESSFUL", "message": "Financial statement and related data deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting FaasFs: {str(e)}")
        return jsonify({"statusCode": "FAILED", "message": "INTERNAL SERVER ERROR"}), 500
    
@fs_bp.route('/v1/page', methods=['PUT'])
@custom_auth_required
def update_page_details():
    try:
        user = get_authenticated_user()
        if not user:
            return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
        
        if not user or user.role != "analyst":
            return jsonify({"status_code": "FAILED", "message": "Analyst access required"}), 403
        
        data = request.get_json()
        page_id = data.get('id')
        document_type = data.get('documentType')
        company_name = data.get('companyName')
        new_years  = data.get('years', [])
        data = data.get('data', [])
        
        # Validate inputs
        if not page_id or not document_type or not company_name or not new_years or not data:
            return jsonify({"statusCode": "FAILED", "message": "Invalid request data"}), 400

        # Find the page
        faas_fs_doc = FaasFsDocs.query.filter_by(id=page_id).first()
        if not faas_fs_doc:
            return jsonify({"statusCode": "FAILED", "message": "Page not found"}), 404

        old_years = [faas_fs_doc.lastYear, faas_fs_doc.currentYear]
        year_mapping = dict(zip(old_years, new_years))
        
        related_docs = FaasFsDocs.query.filter_by(fsId=faas_fs_doc.fsId).all()
        for doc in related_docs:
            doc.lastYear = new_years[0]
            doc.currentYear = new_years[1]

        # Update all related records in FaasFsDocsCs, FaasFsDocsIs, FaasFsDocsBs
        models_to_update = [FaasFsDocsCs, FaasFsDocsIs, FaasFsDocsBs]

        for model in models_to_update:
            for old_year, new_year in year_mapping.items():
                model.query.filter(
                    model.fsDocsId.in_([doc.id for doc in related_docs]),
                    model.year == old_year
                ).update({model.year: new_year}, synchronize_session=False)
        
        if document_type == "Balance Sheet":
            update_model = FaasFsDocsBs
        elif document_type == "Income Statement":
            update_model = FaasFsDocsIs
        elif document_type == "Cash Flow Statement":
            update_model = FaasFsDocsCs
        else:
            db.session.rollback()
            return jsonify({"statusCode": "FAILED", "message": "Invalid document type"}), 400
        
        for item in data:
            field = item.get('field')
            for year in new_years:
                value = item.get(year)
                record = update_model.query.filter_by(fsDocsId=page_id, year=year).first()
                if record:
                    setattr(record, field, value)
                else:
                    new_record = update_model(
                        fsDocsId=page_id,
                        year=year,
                        **{field: value}
                    )
                    db.session.add(new_record)
        
       
        faas_fs = FaasFs.query.get(faas_fs_doc.fsId)
        if faas_fs:
            faas_fs.companyName = company_name


        db.session.commit()
        return jsonify({"statusCode": "SUCCESSFUL", "message": "Financial statement document updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating financial statement document: {str(e)}")
        return jsonify({"statusCode": "FAILED", "message": "INTERNAL SERVER ERROR"}), 500
