from flask import Blueprint, request, jsonify, session
from models import db, bcrypt, CompanyAuth, UserAuth, FaasBs, FaasBsPages, FaasBsTransactions, FaasBsSubcategories, FaasBsSubcategoriesKeywords, current_time_jakarta
from ..utils import generate_id, allowed_file, check_extension, jwt_and_api_key_required, custom_auth_required, get_authenticated_user, encrypt, try_decrypt
from flask_jwt_extended import get_jwt_identity
from ..ai.bs import extract_bs_informations, build_transaction_categories, categorize_transaction, convert_transaction_type
import os
from datetime import datetime

from werkzeug.utils import secure_filename
from pdf2image import convert_from_path
from collections import defaultdict

import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

bs_bp = Blueprint('bs', __name__)

UPLOAD_FOLDER = os.path.join('static','uploads', 'faas', 'bs')

@bs_bp.route('/v1/list', methods=['GET'])
@custom_auth_required
def get_bs_list():
    try:
        user = get_authenticated_user()
        if not user:
            return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
        
        if not user or user.role != "analyst":
            return jsonify({"status_code": "FAILED", "message": "Analyst access required"}), 403
        
        bs_list = FaasBs.query.filter_by(userId=user.id).all()

        if not bs_list:
            return jsonify({"statusCode": "SUCCESSFUL", "bankStatements": []}), 200
        bs_list_serialized = [
    {
        "id": bs.id,
        "title": try_decrypt(bs.title),
        "totalPages": bs.totalPages,
        "status": bs.status,
        "createdAt": bs.createdAt.strftime('%Y-%m-%d %H:%M:%S'),
        "updatedAt": bs.updatedAt.strftime('%Y-%m-%d %H:%M:%S')
    }
    for bs in bs_list
]

        return jsonify({"statusCode": "SUCCESSFUL", "bankStatements": bs_list_serialized}), 200
    except Exception as e:
        logger.error(e)
        return jsonify({"statusCode": "FAILED", "message": "INTERNAL SERVER ERROR."}), 500
    

@bs_bp.route('/v1/create', methods=['POST'])
@custom_auth_required
def create_bs():
    faas_bs = None
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
        company_id=company.id
        id = generate_id()
        title = request.form['title']
        files = request.files.getlist('files')
        SAVE_DIR = os.path.join(UPLOAD_FOLDER, id)
        os.makedirs(SAVE_DIR, exist_ok=True)

        if not files or any(not allowed_file(file.filename) for file in files):
            return jsonify({"statusCode": "FAILED", "message": "Invalid file format"}), 400

        faas_bs = FaasBs(
            id=id,
            companyId=company_id,
            userId=user_id,
            title=title,
            totalPages=0,
            status=0
        )
        db.session.add(faas_bs)
        db.session.commit()

        file_idx = 1
        page_ids = []
        page_paths = []
        for file in files:
            if check_extension(file.filename) == "pdf":
                pdf_path = os.path.join(SAVE_DIR, f'{id}_{file.filename}.pdf')
                file.save(pdf_path)
                pages = convert_from_path(pdf_path, 300)
                os.remove(pdf_path)
                for page in pages:
                    page_id = f'{id}_{file_idx}'
                    page_path = os.path.join(SAVE_DIR,f'{page_id}.jpg')
                    page.save(page_path)
                    page_ids.append(page_id)
                    page_paths.append(page_path)
                    file_idx += 1
            else:
                page_id = f'{id}_{file_idx}'
                page_path = os.path.join(SAVE_DIR,f'{page_id}.jpg')
                file.save(page_path)
                page_ids.append(page_id)
                page_paths.append(page_path)
                file_idx += 1

                
        total_pages = file_idx - 1
        
        company.usage += total_pages

        # Check if user has exceeded their limit
        if company.limit is not None and company.usage > company.limit:
            db.session.rollback()
            return jsonify({"statusCode": "FAILED", "message": "Usage limit exceeded"}), 403

        for p_idx in range(len(page_ids)):
            faas_bs_page = FaasBsPages(
                id=page_ids[p_idx],
                bsId=faas_bs.id,
                source=page_paths[p_idx]
            )
            db.session.add(faas_bs_page)

            result, prompt_usage, completion_usage = extract_bs_informations(page_paths[p_idx])
            logger.info(f"New Result Page with ID: {page_ids[p_idx]}")
            logger.info(result)
            if result:
                transactions = result.get('transactions', [])
                periode_str = "-"
                if transactions:
                    tx_idx = 1
                    first_date = transactions[0].get('date', '') if len(transactions) > 0 else ''
                    last_date = transactions[-1].get('date', '') if len(transactions) > 0 else ''
                    if first_date or last_date:
                        periode_str = f"{first_date} - {last_date}"

                    for transaction in transactions:
                        amount_str = str(transaction.get('amount', '0')).replace(',', '')

                        if amount_str.count('.') >= 2:
                            amount_str = amount_str.replace('.', '')

                        try:
                            amount = float(amount_str)
                        except ValueError:
                            amount = 0.0

                        tx_date_raw = transaction.get('date')
                        try:
                            tx_date = datetime.strptime(tx_date_raw, '%Y-%m-%d') if tx_date_raw else current_time_jakarta()
                        except Exception:
                            tx_date = current_time_jakarta()

                        faas_bs_transaction = FaasBsTransactions(
                            id=f'{faas_bs_page.id}_{tx_idx}',
                            pageId=faas_bs_page.id,
                            date=tx_date,
                            description=encrypt(transaction.get('description', '') or '-'),
                            type=encrypt(transaction.get('type', '') or 'Debit'),
                            amount=amount
                        )
                        db.session.add(faas_bs_transaction)
                        tx_idx += 1

                faas_bs_page.bankName = encrypt(result.get('bankName', '') or '-')
                faas_bs_page.accountNumber = encrypt(result.get('accountNumber', '') or '-')
                faas_bs_page.accountType = encrypt(result.get('accountType', '') or '-')
                faas_bs_page.accountHolderName = encrypt(result.get('accountHolderName', '') or '-')
                faas_bs_page.statementPeriode = encrypt(periode_str)
                faas_bs_page.currency = encrypt(result.get('currency', '') or '-')
                faas_bs_page.promptUsage = prompt_usage
                faas_bs_page.completionUsage = completion_usage
        faas_bs.status = "Finished"
        faas_bs.totalPages = total_pages
        db.session.commit()

        return jsonify({"statusCode": "SUCCESSFUL", "faasBsId": faas_bs.id}), 201
    except Exception as e:
        logger.error(f"Error in create_bs: {e}", exc_info=True)
        db.session.rollback()
        if faas_bs and getattr(faas_bs, 'id', None):
            try:
                faas_bs.status = "Error"
                db.session.commit()
            except Exception as commit_err:
                db.session.rollback()
                logger.error(f"Failed to update faas_bs status to Error: {commit_err}")
        return jsonify({"statusCode": "FAILED", "message": f"INTERNAL SERVER ERROR: {str(e)}"}), 500
    

@bs_bp.route('/v1/delete', methods=['DELETE'])
@custom_auth_required
def delete_bs():
    user = get_authenticated_user()
    if not user:
        return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
    
    if not user or user.role != "analyst":
        return jsonify({"status_code": "FAILED", "message": "Analyst access required"}), 403
    
    bs_id = request.args.get('bsId')
    if not bs_id:
        return jsonify({"statusCode": "FAILED", "message": "Invalid request data"}), 400

    faas_bs = FaasBs.query.filter_by(id=bs_id, userId=user.id).first()
    if not faas_bs:
        return jsonify({"statusCode": "FAILED", "message": "Bank statement not found"}), 404

    try:
        subcategories = FaasBsSubcategories.query.filter_by(bsId=bs_id).all()
        for subcategory in subcategories:
            FaasBsSubcategoriesKeywords.query.filter_by(subcategoryId=subcategory.id).delete()

        FaasBsSubcategories.query.filter_by(bsId=bs_id).delete()

        pages = FaasBsPages.query.filter_by(bsId=bs_id).all()
        for page in pages:
            FaasBsTransactions.query.filter_by(pageId=page.id).delete()

        FaasBsPages.query.filter_by(bsId=bs_id).delete()
        db.session.delete(faas_bs)
        db.session.commit()

        return jsonify({"statusCode": "SUCCESSFUL", "message": "Bank statement and related data deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(e)
        return jsonify({"statusCode": "FAILED", "message": "INTERNAL SERVER ERROR."}), 500


@bs_bp.route('/v1/summary', methods=['GET'])
@custom_auth_required
def get_bs_summary():
    try:
        user = get_authenticated_user()
        if not user:
            return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
        
        if not user or user.role != "analyst":
            return jsonify({"status_code": "FAILED", "message": "Analyst access required"}), 403
        
        bs_id = request.args.get('bsId')
        if not bs_id:
            return jsonify({"statusCode": "FAILED", "message": "Invalid request data"}), 400
        
        faas_bs = FaasBs.query.filter_by(id=bs_id, userId=user.id).first()
        if not faas_bs:
            return jsonify({"statusCode": "FAILED", "message": "Bank statement not found"}), 404

        total_banks = db.session.query(FaasBsPages.bankName).filter_by(bsId=bs_id).distinct().count()
        total_accounts = db.session.query(FaasBsPages.accountNumber).filter_by(bsId=bs_id).distinct().count()
        total_pages = faas_bs.totalPages
        total_transactions = db.session.query(FaasBsTransactions).join(FaasBsPages, FaasBsPages.id == FaasBsTransactions.pageId).filter(FaasBsPages.bsId == bs_id).count()

        return jsonify({
            "statusCode": "SUCCESSFUL",
            "bsId": bs_id,
            "totalBanks": total_banks,
            "totalAccounts": total_accounts,
            "totalPages": total_pages,
            "totalTransactions": total_transactions,            
        }), 200
    except Exception as e:
        logger.error(e)
        return jsonify({"statusCode": "FAILED", "message": "INTERNAL SERVER ERROR."}), 500
    

@bs_bp.route('/v1/accounts/list', methods=['GET'])
@custom_auth_required
def get_bs_accounts_list():
    try:
        user = get_authenticated_user()
        if not user:
            return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
        
        if not user or user.role != "analyst":
            return jsonify({"status_code": "FAILED", "message": "Analyst access required"}), 403
        
        bs_id = request.args.get('bsId')
        if not bs_id:
            return jsonify({"statusCode": "FAILED", "message": "Invalid request data"}), 400
            
        faas_bs = FaasBs.query.filter_by(id=bs_id, userId=user.id).first()
        if not faas_bs:
            return jsonify({"statusCode": "FAILED", "message": "Bank statement not found"}), 404
        
        pages_info = FaasBsPages.query.filter_by(bsId=bs_id).all()
        accounts_dict = {}

        for page in pages_info:
            account_number = page.accountNumber
            if account_number not in accounts_dict:
                transactions = FaasBsTransactions.query.filter_by(pageId=page.id).order_by(FaasBsTransactions.date).all()
                
                # opening_balance = transactions[0].balance if transactions else 0
                # closing_balance = transactions[-1].balance if transactions else 0
                total_deposits = sum(t.amount for t in transactions if ( try_decrypt(t.type) == 'Deposit' or  try_decrypt(t.type) == 'Credit'))
                total_debits = sum(t.amount for t in transactions if ( try_decrypt(t.type) == 'Withdrawal' or  try_decrypt(t.type) == 'Debit'))
                total_no_of_deposits = sum(1 for t in transactions if ( try_decrypt(t.type) == 'Deposit' or  try_decrypt(t.type) == 'Credit'))
                total_no_of_debits = sum(1 for t in transactions if ( try_decrypt(t.type) == 'Withdrawal' or  try_decrypt(t.type) == 'Debit'))
                accounts_dict[account_number] = {
                    "accountNumber": try_decrypt(page.accountNumber),
                    "bankName": try_decrypt(page.bankName),
                    "accountType": try_decrypt(page.accountType),
                    "pagesIndex": [page.id],
                    "accountHolderName": try_decrypt(page.accountHolderName),
                    "statementPeriode": try_decrypt(page.statementPeriode),
                    "currency": try_decrypt(page.currency),
                    # "openingBalance": opening_balance,
                    # "closingBalance": closing_balance,
                    "totalDeposits": total_deposits,
                    "totalDebits": total_debits,
                    "totalNoOfDeposits": total_no_of_deposits,
                    "totalNoOfDebits": total_no_of_debits
                }
            else:
                transactions = FaasBsTransactions.query.filter_by(pageId=page.id).order_by(FaasBsTransactions.date).all()
    
                total_deposits = sum(t.amount for t in transactions if t.type in ['Deposit', 'Credit'])
                total_debits = sum(t.amount for t in transactions if t.type in ['Withdrawal', 'Debit'])
                total_no_of_deposits = sum(1 for t in transactions if t.type in ['Deposit', 'Credit'])
                total_no_of_debits = sum(1 for t in transactions if t.type in ['Withdrawal', 'Debit'])

                accounts_dict[account_number]["totalDeposits"] += total_deposits
                accounts_dict[account_number]["totalDebits"] += total_debits
                accounts_dict[account_number]["totalNoOfDeposits"] += total_no_of_deposits
                accounts_dict[account_number]["totalNoOfDebits"] += total_no_of_debits
                accounts_dict[account_number]["pagesIndex"].append(page.id)

        accounts_list = list(accounts_dict.values())

        return jsonify({
            "statusCode": "SUCCESSFUL",
            "bsId": bs_id,
            "accountsList": accounts_list
        }), 200
    except Exception as e:
        logger.error(e)
        return jsonify({"statusCode": "FAILED", "message": "INTERNAL SERVER ERROR."}), 500
    
    
@bs_bp.route('/v1/pages/details', methods=['GET'])
@custom_auth_required
def get_pages_details():
    try:
        user = get_authenticated_user()
        if not user:
            return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
        
        if not user or user.role != "analyst":
            return jsonify({"status_code": "FAILED", "message": "Analyst access required"}), 403
      
        bs_id = request.args.get('bsId')
        if not bs_id:
            return jsonify({"statusCode": "FAILED", "message": "Invalid request data"}), 400
        
        faas_bs = FaasBs.query.filter_by(id=bs_id, userId=user.id).first()
        if not faas_bs:
            return jsonify({"statusCode": "FAILED", "message": "Bank statement not found"}), 404
        
        pages = FaasBsPages.query.filter_by(bsId=bs_id).order_by(FaasBsPages.id).all()
        pages_list = []
        for page in pages:
            transactions = FaasBsTransactions.query.filter_by(pageId=page.id).all()
            transactions_list = sorted(
                [
                    {
                        "id": transaction.id,
                        "date": transaction.date,
                        "description": try_decrypt(transaction.description),
                        "type":  try_decrypt(transaction.type),
                        "amount": transaction.amount,
                        # "balance": transaction.balance
                    } for transaction in transactions
                ],
                key=lambda x: (x['date'], x['id'])
            )
            
            
            page_data = {
                "id": page.id,
                "source": page.source,
                "bankName": try_decrypt(page.bankName),
                "accountNumber": try_decrypt(page.accountNumber),
                "accountType": try_decrypt(page.accountType),
                "accountHolderName": try_decrypt(page.accountHolderName),
                "statementPeriode": try_decrypt(page.statementPeriode),
                "currency": try_decrypt(page.currency),
                "transactions": transactions_list
            }
            
            pages_list.append(page_data)
        
        return jsonify({
            "statusCode": "SUCCESSFUL",
            "pages": pages_list
        }), 200
    except Exception as e:
        logger.error(e)
        return jsonify({"statusCode": "FAILED", "message": "INTERNAL SERVER ERROR."}), 500
    
    
    
    
@bs_bp.route('/v1/page', methods=['PUT'])
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
        bank_name = data.get('bankName')
        account_number = data.get('accountNumber')
        account_type = data.get('accountType')
        account_holder_name = data.get('accountHolderName')
        statement_periode = data.get('statementPeriode')
        currency = data.get('currency')
        transactions = data.get('transactions')

        # Validate inputs
        if not page_id or not bank_name or not account_number:
            return jsonify({"statusCode": "FAILED", "message": "Invalid request data"}), 400

        # Find the page
        page = FaasBsPages.query.filter_by(id=page_id).first()
        if not page:
            return jsonify({"statusCode": "FAILED", "message": "Page not found"}), 404

        # Update page details
        page.bankName = encrypt(bank_name)
        page.accountNumber = encrypt(account_number)
        page.accountType = encrypt(account_type)
        page.accountHolderName = encrypt(account_holder_name)
        page.statementPeriode = encrypt(statement_periode)
        page.currency = encrypt(currency)
        db.session.commit()

        existing_transaction_ids = [transaction.id for transaction in FaasBsTransactions.query.filter_by(pageId=page_id).all()]
        received_transaction_ids = [transaction.get('id') for transaction in transactions if transaction.get('id')]

        # Delete transactions that are not in the received transactions
        for transaction_id in existing_transaction_ids:
            if transaction_id not in received_transaction_ids:
                transaction_to_delete = FaasBsTransactions.query.filter_by(id=transaction_id).first()
                if transaction_to_delete:
                    db.session.delete(transaction_to_delete)

        # Determine the next transaction index
        max_index = 0
        for transaction_id in existing_transaction_ids:
            index = int(transaction_id.split('_')[-1])
            if index > max_index:
                max_index = index
        next_index = max_index + 1

        # Update or add transactions
        for transaction in transactions:
            transaction_id = transaction.get('id')
            if transaction_id:
                # Update existing transaction
                existing_transaction = FaasBsTransactions.query.filter_by(id=transaction_id).first()
                if existing_transaction:
                    existing_transaction.date = transaction.get('date')
                    existing_transaction.description = encrypt(transaction.get('description'))
                    existing_transaction.type = encrypt(transaction.get('type'))
                    existing_transaction.amount = transaction.get('amount')
                    # existing_transaction.balance = transaction.get('balance')
            else:
                # Add new transaction
                new_transaction_id = f"{page_id}_{next_index}"
                next_index += 1
                new_transaction = FaasBsTransactions(
                    id=new_transaction_id,  # Generate a new ID for the transaction
                    pageId=page_id,
                    date=transaction.get('date'),
                    description=encrypt(transaction.get('description')),
                    type=encrypt(transaction.get('type')),
                    amount=transaction.get('amount'),
                    # balance=transaction.get('balance')
                )
                db.session.add(new_transaction)

        db.session.commit()
        return jsonify({"statusCode": "SUCCESSFUL", "message": "Page details updated successfully"}), 200
    except Exception as e:
        return jsonify({"statusCode": "FAILED", "message": "INTERNAL SERVER ERROR."}), 500
    
@bs_bp.route('/v1/subcategories', methods=['GET'])
@custom_auth_required
def get_subcategories():
    try:
        user = get_authenticated_user()
        if not user:
            return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
        
        if not user or user.role != "analyst":
            return jsonify({"status_code": "FAILED", "message": "Analyst access required"}), 403
        
        bsId = request.args.get('bsId')
        categories = []

        business_subcategories = FaasBsSubcategories.query.filter_by(bsId=bsId, category='Business').all()
        non_business_subcategories = FaasBsSubcategories.query.filter_by(bsId=bsId, category='Non-Business').all()
        if business_subcategories:
            categories.append({
                'name': 'Business',
                'subcategories': [{'subcategoryName': sub.name, 'keywords': [kw.keyword for kw in FaasBsSubcategoriesKeywords.query.filter_by(subcategoryId=sub.id).all()]} for sub in business_subcategories]
            })

        if non_business_subcategories:
            categories.append({
                'name': 'Non-Business',
                'subcategories': [{'subcategoryName': sub.name, 'keywords': [kw.keyword for kw in FaasBsSubcategoriesKeywords.query.filter_by(subcategoryId=sub.id).all()]} for sub in non_business_subcategories]
            })

        return jsonify({"statusCode": "SUCCESSFUL", "categories": categories}), 200
    except Exception as e:
        return jsonify({"statusCode": "FAILED", "message": "INTERNAL SERVER ERROR."}), 500
    

@bs_bp.route('/v1/subcategories', methods=['POST'])
@custom_auth_required
def manage_subcategories():
    try:
        user = get_authenticated_user()
        if not user:
            return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
        
        if not user or user.role != "analyst":
            return jsonify({"status_code": "FAILED", "message": "Analyst access required"}), 403
        
        data = request.json
        bsId = data.get('bsId')
        categories = data.get('categories', [])

        if not bsId or not categories:
            return jsonify({'statusCode': 'FAILED', 'message': 'bsId and categories are required'}), 400

        existing_subcategories = FaasBsSubcategories.query.filter_by(bsId=bsId).all()
        if existing_subcategories:
            for subcategory in existing_subcategories:
                FaasBsSubcategoriesKeywords.query.filter_by(subcategoryId=subcategory.id).delete()
                db.session.delete(subcategory)
            db.session.commit()

        # Add new subcategories and keywords
        for category_data in categories:
            category_name = category_data.get('name')
            subcategories = category_data.get('subcategories', [])

            for subcategory_data in subcategories:
                subcategory_name = subcategory_data.get('subcategoryName')
                keywords = subcategory_data.get('keywords', [])

                # Generate UUID for the new subcategory
                subcategory_id = generate_id()
                new_subcategory = FaasBsSubcategories(id=subcategory_id, bsId=bsId, category=category_name, name=subcategory_name)
                db.session.add(new_subcategory)
                db.session.commit()

                # Add new keywords with UUIDs
                for keyword in keywords:
                    keyword_id = generate_id()
                    new_keyword = FaasBsSubcategoriesKeywords(id=keyword_id, subcategoryId=subcategory_id, keyword=keyword)
                    db.session.add(new_keyword)

                db.session.commit()

        return jsonify({"statusCode": "SUCCESSFUL", "message": "Subcategories updated successfully"}), 200
    except Exception as e:
        logger.error(e)
        return jsonify({"statusCode": "FAILED", "message": "INTERNAL SERVER ERROR."}), 500
    
@bs_bp.route('/v1/transactions/activity', methods=['GET'])
@custom_auth_required
def get_transactions_activity():
    try:
        user = get_authenticated_user()
        if not user:
            return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
        
        if not user or user.role != "analyst":
            return jsonify({"status_code": "FAILED", "message": "Analyst access required"}), 403
        
        bs_id = request.args.get('bsId')
        if not bs_id:
            return jsonify({"statusCode": "FAILED", "message": "Invalid request data"}), 400
        
        faas_bs = FaasBs.query.filter_by(id=bs_id, userId=user.id).first()
        if not faas_bs:
            return jsonify({"statusCode": "FAILED", "message": "Bank statement not found"}), 404
        
        transaction_categories = build_transaction_categories(bs_id)
        
        transactions = db.session.query(FaasBsTransactions, FaasBsPages.currency)\
                                .join(FaasBsPages, FaasBsPages.id == FaasBsTransactions.pageId)\
                                .filter(FaasBsPages.bsId == bs_id).all()
        transactions_data = []
        months = set()
        for transaction, currency in transactions:
            category, subcategory = categorize_transaction( try_decrypt(transaction.description), transaction_categories)
            month = transaction.date.strftime("%m-%Y")
            months.add(month)
            transaction_data = {
                'date': transaction.date,
                'month': month,
                'currency': try_decrypt(currency),
                'category': category,
                'subcategory': subcategory,
                'type': convert_transaction_type( try_decrypt(transaction.type)),
                'amount': transaction.amount,
                'description':  try_decrypt(transaction.description)
            }
            transactions_data.append(transaction_data)
        sorted_months = sorted(list(months), key=lambda x: (int(x.split('-')[1]), int(x.split('-')[0])))
        return jsonify({
            "statusCode": "SUCCESSFUL",
            "months": sorted_months,
            "transactionsData": transactions_data  
        }), 200
    except Exception as e:
        logger.error(e)
        return jsonify({"statusCode": "FAILED", "message": "INTERNAL SERVER ERROR."}), 500
    
